import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { Axios, AxiosInstance } from 'axios';
import * as https from 'node:https';
import * as http from 'node:http';

@Injectable()
export class AccountService {
  private instanceForBalance: AxiosInstance;
  private accounts: Account[];
  private odinBalances: number[] = [];
  private heimdallBalances: number[] = [];
  private usedAccounts: { odin: Set<number>; heimdall: Set<number> } = {
    odin: new Set(),
    heimdall: new Set(),
  };

  private inactiveAccounts: { odin: Set<number>; heimdall: Set<number> } = {
    odin: new Set(),
    heimdall: new Set(),
  };

  private activeOdinAccounts = [0, 1, 2, 3, 4, 5, 6, 7]; //직접 오류 나는 계좌 확인하고 나머지만 남김
  private activeHeimdallAccounts = [0, 1, 2, 3, 8];

  constructor(private readonly configService: ConfigService) {
    this.accounts = this.loadAccountsFromConfig();
    this.instanceForBalance = axios.create({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });
  }

  /**
   * 특정 그룹의 활성화된 계좌만 필터링하여 잔고 순 정렬 (높은 순)
   */
  private getSortedAccounts(
    group: 'odin' | 'heimdall',
  ): { index: number; balance: number }[] {
    const balances =
      group === 'odin' ? this.odinBalances : this.heimdallBalances;
    const activeAccounts =
      group === 'odin' ? this.activeOdinAccounts : this.activeHeimdallAccounts;
    const inactiveSet = this.inactiveAccounts[group];

    return activeAccounts
      .filter((index) => {
        if (balances[index] === undefined) {
          this.markAccountAsInactive(group, index); // 비활성화 처리
          return false; // 리스트에서 제거
        }
        return !inactiveSet.has(index); // 비활성화된 계좌 제외
      })
      .map((index) => ({ index, balance: balances[index]! })) // 이제 undefined 없음
      .sort((a, b) => b.balance - a.balance);
  }

  /**
   * 송금 계좌와 수신 계좌를 동시에 선택 (중복 방지 + 오류 처리 포함)
   */
  getTransactionPair(
    group: 'odin' | 'heimdall',
  ): { senderIndex: number; receiverIndex: number } | null {
    const sortedAccounts = this.getSortedAccounts(group);
    const usedSet = this.usedAccounts[group];

    let senderIndex: number | null = null;
    let receiverIndex: number | null = null;

    // 송금 계좌 선택 (잔고가 높은 계좌 중 사용되지 않은 것)
    for (const account of sortedAccounts) {
      if (!usedSet.has(account.index) && account.balance > 0) {
        senderIndex = account.index;
        usedSet.add(senderIndex); // 송금 계좌로 등록
        break;
      }
    }

    if (senderIndex === null) {
      console.error(
        `[ERROR] ${group.toUpperCase()}: No available sender accounts. Increase number of accounts.`,
      );
      return null;
    }
    // 수신 계좌 선택 (잔고가 낮은 계좌 중 송금 계좌와 다른 것)
    for (let i = sortedAccounts.length - 1; i >= 0; i--) {
      const account = sortedAccounts[i];
      if (account.index !== senderIndex) {
        receiverIndex = account.index;
        break;
      }
    }

    if (receiverIndex === null) {
      console.error(
        `[ERROR] ${group.toUpperCase()}: No available reciever accounts.`,
      );
      return null;
    }

    return { senderIndex, receiverIndex };
  }

  private loadAccountsFromConfig(): Account[] {
    const accounts: Account[] = [];
    const accountCount = this.configService.get<number>('ACCOUNT_COUNT') || 9; // 계정 개수를 환경 변수에서 가져오거나 기본값 사용

    for (let i = 0; i < accountCount; i++) {
      const privateKey = this.configService.get<string>(`PRIVATE_KEY_${i}`);
      const address = this.configService.get<string>(`ACCOUNT_ADDRESS_${i}`);

      if (!privateKey || !address) {
        console.warn(
          `[WARN] Account configuration missing for index ${i}. Marking as inactive.`,
        );
        this.inactiveAccounts.odin.add(i); // 비활성화 목록에 추가
        this.inactiveAccounts.heimdall.add(i);
        continue; // 다음 계정 로딩으로 넘어감
      }

      accounts.push({ privateKey, address });
    }

    return accounts;
  }

  roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  getAccounts(): Account[] {
    return this.accounts;
  }

  getBalance(group: 'odin' | 'heimdall', index: number): number {
    return group === 'odin'
      ? this.odinBalances[index]
      : this.heimdallBalances[index];
  }

  updateBalance(
    group: 'odin' | 'heimdall',
    index: number,
    amount: number,
  ): void {
    if (group === 'odin') {
      this.odinBalances[index] = this.roundToTwoDecimals(
        this.odinBalances[index] + amount,
      );
    } else {
      this.heimdallBalances[index] = this.roundToTwoDecimals(
        this.heimdallBalances[index] + amount,
      );
    }
  }

  /**
   * 잔고 업데이트 실패 시 비활성화 계좌 목록에 추가
   */
  markAccountAsInactive(group: 'odin' | 'heimdall', index: number): void {
    this.inactiveAccounts[group].add(index);
    console.warn(
      `[WARN] ${group.toUpperCase()}: account ${index} marked as inactive`,
    );
  }

  /**
   * 모든 계좌 소진 시 에러 발생
   */
  checkAllAccountsUsed(group: 'odin' | 'heimdall'): void {
    const activeCount = (
      group === 'odin' ? this.activeOdinAccounts : this.activeHeimdallAccounts
    ).length;
    const usedCount = this.usedAccounts[group].size;
    const inactiveCount = this.inactiveAccounts[group].size;

    if (activeCount === usedCount + inactiveCount) {
      console.error(
        `[FATAL] ${group.toUpperCase()}: every acccounts are in use or inactive. increase number of accounts`,
      );
      throw new Error(`No available accounts for ${group.toUpperCase()}`);
    }
  }

  async updateAllAccountBalances(): Promise<void> {
    try {
      // console.log('Updating account balances...');
      const { newOdinBalances, newHeimdallBalances } =
        await this.getAllAccountBalances();

      this.odinBalances = newOdinBalances;
      this.heimdallBalances = newHeimdallBalances;

      // Remove only successfully updated accounts from inactive list
      newOdinBalances.forEach((balance, index) => {
        if (balance !== null) {
          this.inactiveAccounts.odin.delete(index);
        }
      });

      newHeimdallBalances.forEach((balance, index) => {
        if (balance !== null) {
          this.inactiveAccounts.heimdall.delete(index);
        }
      });

      console.log('Account balances updated successfully.');
    } catch (error) {
      console.error('Failed to update account balances:', error);
    }
  }

  public async getAllAccountBalances(): Promise<{
    newOdinBalances: number[];
    newHeimdallBalances: number[];
  }> {
    const accountBalancePromises = this.accounts.map(async (_, i) => {
      let odinBalance = 0;
      let heimdallBalance = 0;

      try {
        const odinResponse = await this.getAccountBalance(i, 'odin');
        odinBalance = parseFloat(
          odinResponse?.data?.stateQuery?.balance?.quantity || '0',
        );
      } catch (error) {
        console.error(
          `Failed to fetch balance for group odin account ${i}:`,
          error,
        );
        odinBalance = this.odinBalances[i] ?? 0.14; // 에러 시 기존 데이터나 적절한 기본값 (약 총 금액의 11%) 활용
      }

      try {
        const heimdallResponse = await this.getAccountBalance(i, 'heimdall');
        heimdallBalance = parseFloat(
          heimdallResponse?.data?.stateQuery?.balance?.quantity || '0',
        );
      } catch (error) {
        console.error(
          `Failed to fetch balance for group heimdal account ${i}:`,
          error,
        );
        heimdallBalance = this.heimdallBalances[i] ?? 0.23; // 에러 시 기존 데이터나 적절한 기본값 (약 총 금액의 11%) 활용
      }

      return { odinBalance, heimdallBalance };
    });

    const results = await Promise.all(accountBalancePromises);

    // 결과를 병합
    const newOdinBalances = results.map((result) => result.odinBalance);
    const newHeimdallBalances = results.map((result) => result.heimdallBalance);

    return {
      newOdinBalances,
      newHeimdallBalances,
    };
  }

  async getAccountBalance(accountNumber: number, group: 'odin' | 'heimdall') {
    const account = this.accounts[accountNumber]; // 계정 정보 가져오기
    const endpoint =
      group === 'odin'
        ? 'https://odin-rpc-1.nine-chronicles.com/graphql'
        : 'https://heimdall-rpc-2.nine-chronicles.com/graphql';

    const balanceQuery = `
      query getBalance($address: Address!, $minters: [Address!]!) {
        stateQuery {
          balance(
            address: $address,
            currency: {
              ticker: "NCG",
              decimalPlaces: 2,
              minters: $minters
            }
          ) {
            quantity
          }
        }
      }
    `;

    const variables = {
      address: account.address,
      minters:
        group === 'odin' ? ['0x47d082a115c63e7b58b1532d20e631538eafadde'] : [],
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `[${group.toUpperCase()}] Fetching balance for account ${accountNumber} (Attempt ${attempt}/3)...`,
        );
        const response = await this.instanceForBalance.post(endpoint, {
          query: balanceQuery,
          variables,
        });
        return response.data;
      } catch (error) {
        console.warn(
          `[${group.toUpperCase()}] Failed to fetch balance for account ${accountNumber} (Attempt ${attempt}/3)`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2-second delay before retry
      }
    }

    console.error(
      `[${group.toUpperCase()}] Failed to fetch balance for account ${accountNumber} after 3 attempts. will use previous value.`,
    );
    //    this.markAccountAsInactive(group, accountNumber);
    return null;
  }

  public clearUsedAccounts(): void {
    this.usedAccounts.odin.clear();
    this.usedAccounts.heimdall.clear();
    // console.log('Cleared used accounts for both Odin and Heimdall.');
  }
}

interface Account {
  privateKey: string;
  address: string;
}

