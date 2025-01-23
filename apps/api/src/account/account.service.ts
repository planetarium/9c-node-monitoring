import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { Axios, AxiosInstance } from 'axios';
import * as https from 'node:https';
import * as http from 'node:http';

@Injectable()
export class AccountService {
  private accounts: Account[];
  private odinBalances: number[] = [];
  private heimdallBalances: number[] = [];
  private instanceForBalance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.accounts = this.loadAccountsFromConfig();
    this.instanceForBalance = axios.create({
      timeout: 10000,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });
  }

  private loadAccountsFromConfig(): Account[] {
    return Array.from({ length: 9 }, (_, i) => {
      const privateKey = this.configService.get<string>(`PRIVATE_KEY_${i}`);
      const address = this.configService.get<string>(`ACCOUNT_ADDRESS_${i}`);
      if (!privateKey || !address) {
        throw new Error(`Account configuration missing for index ${i}`);
      }
      return { privateKey, address };
    });
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

  getLowestBalanceAccount(group: 'odin' | 'heimdall'): number | null {
    try {
      const balances =
        group === 'odin' ? this.odinBalances : this.heimdallBalances;

      if (balances.length === 0) {
        throw new Error('Balance array is empty');
      }

      const minIndex = balances.reduce(
        (minIndex, balance, index) =>
          balance < balances[minIndex] ? index : minIndex,
        0,
      );
      console.log(
        'getLowestBalanceAccount: group',
        group,
        'selected minIndex',
        minIndex,
      );
      return minIndex;
    } catch (error) {
      console.error('Error in getLowestBalanceAccount:', error);
      return null; // 오류 발생 시 기본값 반환
    }
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

  async updateAllAccountBalances(): Promise<void> {
    try {
      //   console.log('before updating account balances');
      //   console.log(this.odinBalances);
      //   console.log(this.heimdallBalances);
      const { newOdinBalances, newHeimdallBalances } =
        await this.getAllAccountBalances();
      this.odinBalances = newOdinBalances;
      this.heimdallBalances = newHeimdallBalances;
      console.log('updated account balances');
      console.log(newOdinBalances);
      console.log(newHeimdallBalances);
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

  async getAccountBalance(accountNumber: number, group: string) {
    const account = this.accounts[accountNumber]; // 계정 정보 가져오기
    const endpoint =
      group === 'odin'
        ? 'https://odin-rpc-1.nine-chronicles.com/graphql'
        : 'https://heimdall-rpc-2.nine-chronicles.com/graphql';

    // TODO: 실패 시 다른 엔드포인트로 재시도하는 로직 추가
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
        group === 'odin' ? ['0x47d082a115c63e7b58b1532d20e631538eafadde'] : [], // 발행자 주소 목록
    };

    try {
      const response = await this.instanceForBalance.post(endpoint, {
        query: balanceQuery,
        variables,
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch balance from ${endpoint}:`, error);
      throw error;
    }
  }
}

interface Account {
  privateKey: string;
  address: string;
}

