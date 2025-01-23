import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, In, Timestamp, MoreThan } from 'typeorm';
import { Transaction } from './transaction.entity';
import { AccountService } from 'src/account/account.service';

import { AxiosError } from 'axios/index';
import { catchError, firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { ethers } from 'ethers'; //"ethers": "^5.5.1";
import { encode, RecordView } from '@planetarium/bencodex'; //"@planetarium/bencodex": "^0.2.2",

import axios from 'axios';
import * as https from 'node:https';
import * as http from 'node:http';
import * as secp256k1 from 'secp256k1'; //"secp256k1": "^5.0.0",
import * as crypto from 'crypto';
import { ExceptionsHandler } from '@nestjs/core/exceptions/exceptions-handler';
import e, { response } from 'express';
import { group } from 'node:console';

@Injectable()
export class TransactionService {
  private endPointListURL = 'https://planets.nine-chronicles.com/planets/';
  private instanceForSend;
  private instanceForCheck;
  private accounts: Account[] = []; //cached accounts
  private sendCount = 0;
  private readonly balanceUpdateThreshold = 7;
  private isBalanceChecked = false;

  constructor(
    @InjectRepository(Transaction) //기본 레포지토리. 복잡한 기능이 필요하다면 커스텀으로 변경하자. readonly
    private transactionsRepository: Repository<Transaction>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly accountService: AccountService,
  ) {
    this.instanceForSend = axios.create({
      //안정적인 비동기 전송을 위해 keepAlive 활성화
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 20000,
    });
    this.instanceForCheck = axios.create({
      //안정적인 비동기 전송을 위해 keepAlive 활성화
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: 20000,
    });
  }

  async onModuleInit(): Promise<void> {
    // 서비스 초기화 시 계정을 캐싱
    this.accounts = this.accountService.getAccounts();
    console.log('Cached accounts:', this.accounts);
  }

  /* controller 호출 함수 */
  public async sendTransactionToNodes() {
    // fetch 구현 후 개발 => 그대로 갖고 온 거라 하나씩 테스트하며 진행해야 한다.

    this.sendCount++;

    if (this.sendCount === 1) {
      console.log('send count : ', this.sendCount, 'update balance.');
      try {
        await this.accountService.updateAllAccountBalances();
        this.isBalanceChecked = true; // 한번이라도 체크를 한 경우에만 계좌 배분 시스템 활용 가능
      } catch (error) {
        console.error('Error : updating initial balance failed', error);
      }
    }

    // RPC 엔드포인트 로드
    const [odinRPCEndpoints, heimdallRPCEndpoints] =
      await this.getRPCEndpoints(); //TODO 나중에는 캐시로 한 번만 불러오게

    // 분 단위 timestamp 생성
    const currentTimeStamp = new Date();
    currentTimeStamp.setSeconds(0, 0);

    // transaction 상태 temp로 임시 생성
    await this.createTempStatus('odin', odinRPCEndpoints, currentTimeStamp);
    await this.createTempStatus(
      'heimdall',
      heimdallRPCEndpoints,
      currentTimeStamp,
    );

    // 각 RPC에 transaction 보내고 상태 업데이트 (transaction 전송 실패했다면 false로 처리)
    await this.sendAndUpdateStatus('odin', odinRPCEndpoints, currentTimeStamp);
    await this.sendAndUpdateStatus(
      'heimdall',
      heimdallRPCEndpoints,
      currentTimeStamp,
    );

    return;
  }

  public async updatePendingTransactions() {
    // fetch 구현 후 개발
    const pendingTransactions: Array<{
      id: number;
      endpoint_url: string;
      txHash: string;
      timeStamp: Date;
    }> = await this.getPendingTransactions(); // 명시적 타입

    console.log(
      'updatependingTransactions. count: ',
      pendingTransactions.length,
    );

    // endpoint_url 기준으로 그룹화
    const groupedTransactions = pendingTransactions.reduce<{
      [key: string]: Array<{
        id: number;
        endpoint_url: string;
        txHash: string;
        timeStamp: Date;
      }>;
    }>((acc, row) => {
      if (!acc[row.endpoint_url]) {
        acc[row.endpoint_url] = [];
      }
      acc[row.endpoint_url].push(row);
      return acc;
    }, {});

    let checkEndpointUrl;
    // 각 endpoint_url 그룹별로 상태 조회 및 처리
    for (const [endpoint_url, transactions] of Object.entries(
      groupedTransactions,
    )) {
      console.log('start checking status', endpoint_url);
      const txIds = transactions.map((tx) => tx.txHash); // 해당 endpoint_url에 해당하는 txHash 배열

      if (endpoint_url.includes('heimdall'))
        checkEndpointUrl = 'https://heimdall-rpc-2.nine-chronicles.com/graphql';
      else checkEndpointUrl = 'https://odin-rpc-1.nine-chronicles.com/graphql'; //TODO: 원래 odin-rpc-2였는데 이거 작동 안해서 1로 바꿈. 왜 이렇게 정하는 거지? 얘네가 문제 생기면 어떡하려고?

      const statuses = await this.getTxStatus(checkEndpointUrl, txIds);
      // 5. 상태별로 처리
      for (const [index, status] of statuses.entries()) {
        const row = transactions[index]; // 각 상태에 대응하는 트랜잭션 정보
        const result = {
          id: row.id,
          status,
        };
        console.log(result);

        const elapsedTime =
          (new Date().getTime() - new Date(row.timeStamp).getTime()) / 1000;
        if (result.status.txStatus === 'SUCCESS') {
          await this.updateCompletedTx(result.id);
          console.log('updateCompletedTx', result.id);
        } else if (
          result.status.txStatus === 'STAGING' ||
          result.status.txStatus === 'INCLUDED' ||
          result.status.txStatus === 'INVALID'
        ) {
          // 시간 조건부터 보고 진행
          console.log(
            'STAGING : state',
            result.status.txStatus,
            'elapsedTime',
            elapsedTime,
          );
          if (elapsedTime > 180) {
            // 3분 이상 STAGING 상태인 경우 timout으로 처리
            console.log(
              `Transaction ${row.txHash} has been staging for ${elapsedTime} seconds. Marking as FAILED.`,
            );
            await this.updateFailedTx(
              result.id,
              ['Staging timeout', elapsedTime.toString()],
              true,
            );
          }
          console.log('updateStagingTx', result.id);
        } else if (result.status.txStatus === 'FAILURE') {
          await this.updateFailedTx(
            result.id,
            result.status.exceptionNames,
            false,
          );
          console.log('updateFailedTx', result.id);
        } else {
          await this.updateFailedTx(
            result.id,
            result.status.exceptionNames,
            false,
          );
          console.error(
            'Unexpected status in updatePendingTransactions. STATUS : ',
            result.status.txStatus,
            'id : ',
            result.id,
          );
        }
      }
    }
    console.log('updatePendingTransactions end');

    if (this.sendCount % this.balanceUpdateThreshold === 0) {
      console.log('send count : ', this.sendCount, 'update balance');
      try {
        await this.accountService.updateAllAccountBalances();
        this.isBalanceChecked = true; // 한번이라도 체크를 한 경우에만 계좌 배분 시스템 활용
      } catch (error) {
        console.error('Error : updating balance failed', error);
      }
    }

    return;
  }

  public async fetchTransactions(
    start: string,
    end: string,
    group?: string,
    optionalRange?: { start: string; end: string }, // 추가 범위
  ) {
    // 1분 전까지만 fetch (pending, temp 노출되지 않도록)
    const oneMinuteAgo = new Date(Date.now() - 60000);

    const adjustRange = (start: string, end: string) => {
      const adjustedEnd =
        new Date(end) > oneMinuteAgo ? oneMinuteAgo : new Date(end);
      const startDate = new Date(start);
      if (adjustedEnd < startDate) {
        return null; // 유효하지 않은 범위
      }
      return { startDate, adjustedEnd };
    };

    // 첫 번째 범위
    const primaryRange = adjustRange(start, end);
    if (!primaryRange) return [];

    const { startDate: primaryStart, adjustedEnd: primaryEnd } = primaryRange;

    // 두 번째 범위 처리 (optionalRange가 있는 경우)
    let secondaryStart: Date | undefined;
    let secondaryEnd: Date | undefined;
    if (optionalRange) {
      const secondaryRange = adjustRange(
        optionalRange.start,
        optionalRange.end,
      );
      if (secondaryRange) {
        secondaryStart = secondaryRange.startDate;
        secondaryEnd = secondaryRange.adjustedEnd;
      }
    }

    const baseQuery: Record<string, any> = {};
    if (group && group !== 'all') {
      baseQuery.group_name = group;
    }

    // 첫 번째 범위 데이터 가져오기
    const primaryTransactionStatus = await this.transactionsRepository.find({
      where: {
        ...baseQuery,
        timeStamp: Between(primaryStart, primaryEnd),
      },
    });

    // 두 번째 범위 데이터 가져오기 (optionalRange가 있는 경우)
    let secondaryTransactionStatus: any[] = [];
    if (secondaryStart && secondaryEnd) {
      secondaryTransactionStatus = await this.transactionsRepository.find({
        where: {
          ...baseQuery,
          timeStamp: Between(secondaryStart, secondaryEnd),
        },
      });
    }

    // 두 범위 데이터를 병합하여 반환
    return [...primaryTransactionStatus, ...secondaryTransactionStatus];
  }

  public async generateDailyTransactionSummary(start: Date, end: Date) {
    // 나머지 기능 전부 완료 후 필요 시 개발
    return;
  }

  /* helper 함수 */
  /* send transaction 부분은 대부분 기존 함수 그대로 사용 */
  public async getRPCEndpoints() {
    const { data } = await firstValueFrom(
      this.httpService.get(this.endPointListURL).pipe(
        catchError((error: AxiosError) => {
          console.log('Error fetching transaction history:', error.message);
          throw new Error(
            'An error occurred while fetching transaction history.',
          );
        }),
      ),
    );
    const odinRPCEndpoints = data[0].rpcEndpoints['headless.gql'];
    const heimdallRPCEndpoints = data[1].rpcEndpoints['headless.gql'];
    return [odinRPCEndpoints, heimdallRPCEndpoints];
  }

  public async createTempStatus(
    groupName: string,
    rpcEndpoints: string[],
    timeStamp: Date,
  ) {
    for (let i = 0; i < rpcEndpoints.length; i++) {
      if (i >= this.accounts.length) {
        console.log('More endpoints than accounts'); //만약 엔드포인트가 훨씬 더 늘어났을 경우 계정 생성 바람.
        break;
      }
      const transaction = new Transaction();
      transaction.timeStamp = timeStamp;
      transaction.group_name = groupName;
      transaction.endpoint_url = rpcEndpoints[i];
      transaction.active = 'temp';
      try {
        console.log(await this.transactionsRepository.save(transaction));
      } catch (error) {
        console.error(error);
      }
    }
  }

  public async sendAndUpdateStatus(
    groupName: 'odin' | 'heimdall',
    rpcEndpoints: string[],
    timeStamp: Date,
  ) {
    // 계좌 조회 알고리즘 아직 구현하지 못함
    // 일단 endpoint를 accounts 이하의 수로 나눠 가장 많은 계정을 사용하는 것으로 구현
    let usingAccountNumber = 2;
    for (let i = this.accounts.length; i > 2; i--) {
      if (rpcEndpoints.length % i === 0) {
        usingAccountNumber = i;
        break;
      }
    }
    console.log('rpcEndpoints.length', rpcEndpoints.length);
    console.log('usingAccountNumber', usingAccountNumber);

    for (let i = 0; i < rpcEndpoints.length; i++) {
      // if (i >= this.accounts.length) { // 기존 코드는 그냥 length 조건으로 활용
      //   console.log('More endpoints than accounts');
      // }
      const accountNumber = i % usingAccountNumber;
      const senderIndex = accountNumber;
      const recieverIndex = this.isBalanceChecked
        ? (this.accountService.getLowestBalanceAccount(groupName) ??
          (accountNumber + 1) % usingAccountNumber)
        : (accountNumber + 1) % usingAccountNumber;
      const sender = this.accounts[senderIndex].address;
      const recipient = this.accounts[recieverIndex].address;
      console.log(
        'accountNumber',
        accountNumber,
        'sender',
        sender,
        'recipient',
        recipient,
      );
      let action;
      const amount = 1n;
      if (groupName === 'odin')
        action = this.makeTransferInOdin(sender, recipient, amount);
      else action = this.makeTransferInHeimdall(sender, recipient, amount);
      try {
        const txHash = await this.sendTx(
          rpcEndpoints[i],
          action,
          this.accounts[i], //TODO: 만약 nonce를 직접 처리하고, 전송 계좌를 바꿔가며 더 높은 안정성 추구한다면 senderIndex로 수정해야 한다.
        );
        if (!txHash) {
          console.error(
            `Transaction hash is undefined for endpoint: ${rpcEndpoints[i]}`,
          );
          continue;
        }
        console.log('Network', rpcEndpoints[i], 'sendtx', txHash);
        console.log('Sender', sender, 'Recipient', recipient);
        this.accountService.updateBalance(
          groupName,
          senderIndex,
          -Number(amount) / 100,
        );
        this.accountService.updateBalance(
          groupName,
          recieverIndex,
          Number(amount) / 100,
        );
        await this.updateTempTx(
          rpcEndpoints[i],
          txHash,
          timeStamp,
          'pending',
          '',
        );
      } catch (error) {
        console.error(
          `Error sending transaction to ${rpcEndpoints[i]}:`,
          error.message || error,
        );
        if (this.isErrorLogInclude('socket hang up', error)) {
          await this.updateTempTx(
            rpcEndpoints[i],
            '',
            timeStamp,
            'false',
            'failed send request - socket hang up, ' + error.message || error,
          );
        } else if (this.isErrorLogInclude('timeout', error)) {
          await this.updateTempTx(
            rpcEndpoints[i],
            '',
            timeStamp,
            'false',
            'failed send request - exceeded 20s, ' + error.message || error,
          );
        } else {
          await this.updateTempTx(
            rpcEndpoints[i],
            '',
            timeStamp,
            'temp',
            'failed send request - unknown error, ' + error.message || error,
          );
        }
      }
    }
  }

  private makeTransferInOdin(
    sender: string,
    recipient: string,
    amount: bigint,
  ) {
    return Buffer.from(
      encode(
        new RecordView(
          {
            type_id: 'transfer_asset5',
            values: {
              amount: [
                new RecordView(
                  {
                    decimalPlaces: Buffer.from([0x02]),
                    minters: [
                      this.hexToBuffer(
                        '0x47d082a115c63e7b58b1532d20e631538eafadde',
                      ),
                    ],
                    ticker: 'NCG',
                  },
                  'text',
                ),
                amount,
              ],
              recipient: this.hexToBuffer(recipient),
              sender: this.hexToBuffer(sender),
            },
          },
          'text',
        ),
      ),
    ).toString('hex');
  }

  private makeTransferInHeimdall(
    sender: string,
    recipient: string,
    amount: bigint,
  ) {
    return Buffer.from(
      encode(
        new RecordView(
          {
            type_id: 'transfer_asset5',
            values: {
              amount: [
                new RecordView(
                  {
                    decimalPlaces: Buffer.from([0x02]),
                    minters: null,
                    ticker: 'NCG',
                  },
                  'text',
                ),
                amount,
              ],
              recipient: this.hexToBuffer(recipient),
              sender: this.hexToBuffer(sender),
            },
          },
          'text',
        ),
      ),
    ).toString('hex');
  }

  hexToBuffer(hex: string): Buffer {
    return Buffer.from(
      ethers.utils.arrayify(hex, { allowMissingPrefix: true }),
    );
  }

  pad32(msg: Buffer): Buffer {
    let buf: Buffer;
    if (msg.length < 32) {
      buf = Buffer.alloc(32);
      buf.fill(0);
      msg.copy(buf, 32 - msg.length);
      return buf;
    } else {
      return msg;
    }
  }

  async sendTx(
    endpoint: string,
    action: string,
    account: Account,
  ): Promise<string | undefined> {
    const wallet = new ethers.Wallet(account.privateKey);
    const nonce = await this.nextTxNonce(endpoint, account.address); //nonce는 전송 account를 기준으로 결정된다.
    console.log('endpoint', endpoint, 'account', account.address);
    console.log('nonce', nonce);
    const _unsignedTx = await this.unsignedTx(
      endpoint,
      wallet.publicKey.slice(2),
      action,
      nonce,
    );
    const unsignedTxId = crypto
      .createHash('sha256')
      .update(_unsignedTx, 'hex')
      .digest();
    const { signature } = secp256k1.ecdsaSign(
      this.pad32(unsignedTxId),
      this.hexToBuffer(wallet.privateKey),
    );
    const sign = Buffer.from(secp256k1.signatureExport(signature));
    const {
      data: {
        transaction: { signTransaction: signTx },
      },
    } = await this.signTransaction(endpoint, _unsignedTx, sign.toString('hex'));
    const { txId } = await this.stageTx(endpoint, signTx);
    return txId;
  }

  async nextTxNonce(endpoint: string, address: string): Promise<number> {
    const { data } = await this.instanceForSend.post(endpoint, {
      variables: { address },
      query: `
              query getNextTxNonce($address: Address!){
                transaction{
                    nextTxNonce(address: $address)
                }
              }
            `,
    });
    return data['data']['transaction']['nextTxNonce'];
  }

  async unsignedTx(
    endpoint: string,
    publicKey: string,
    plainValue: string,
    nonce: number,
  ): Promise<string> {
    const maxGasPrice: FungibleAssetValue = {
      quantity: 1,
      ticker: 'Mead',
      decimalPlaces: 18,
    };

    const { data } = await this.instanceForSend.post(endpoint, {
      variables: { publicKey, plainValue, nonce, maxGasPrice },
      query: `
                query unsignedTx($publicKey: String!, $plainValue: String!, $nonce: Long, $maxGasPrice: FungibleAssetValueInputType) {
                  transaction {
                    unsignedTransaction(publicKey: $publicKey, plainValue: $plainValue nonce: $nonce, maxGasPrice: $maxGasPrice)
                  }
                }
              `,
    });
    return data['data']['transaction']['unsignedTransaction'];
  }

  async signTransaction(
    endpoint: string,
    unsignedTx: string,
    base64Sign: string,
  ): Promise<any> {
    const { data } = await this.instanceForSend.post(endpoint, {
      variables: { unsignedTx, signature: base64Sign },
      query: `
                  query attachSignature($unsignedTx: String!, $signature: String!) {
                    transaction {
                      signTransaction(unsignedTransaction: $unsignedTx, signature: $signature)
                    }
                  }
                `,
    });

    return data;
  }

  async stageTx(endpoint: string, payload: string): Promise<{ txId: string }> {
    const { data } = await this.instanceForSend.post(endpoint, {
      variables: { payload },
      query: `
            mutation transfer($payload: String!) {
              stageTransaction(payload: $payload)
            }
          `,
    });
    try {
      return { txId: data['data']['stageTransaction'] };
    } catch (e) {
      console.log(e, data);
      throw e;
    }
  }

  isErrorLogInclude = (log: string, error: any) => {
    // 에러 객체의 구조와 메시지를 로깅하는 헬퍼 함수
    const logErrorStructure = (error: any) => {
      console.log('==== Error Structure Log ====');
      console.log('Type of error:', typeof error);

      if (typeof error === 'object') {
        try {
          console.log('Error JSON:', JSON.stringify(error, null, 2));
        } catch {
          console.log('Error toString:', error.toString());
        }
      } else {
        console.log('Error:', error);
      }

      if (error instanceof Error) {
        console.log('Error message (from Error object):', error.message);
      }

      console.log('=============================');
    };

    // error를 문자열로 변환하는 헬퍼 함수
    const stringifyError = (error: any): string => {
      if (typeof error === 'string') {
        return error; // 이미 문자열이면 그대로 반환
      }
      if (error instanceof Error) {
        return error.message; // Error 객체의 메시지 반환
      }
      try {
        return JSON.stringify(error); // JSON으로 변환
      } catch {
        return String(error); // JSON 변환 실패 시 일반 문자열로 변환
      }
    };

    // 변환된 문자열을 사용하여 비교
    const errorString = stringifyError(error);
    return errorString.includes(log);
  };

  async getTxStatus(endpoint: string, txIds: string[]) {
    try {
      const { data } = await this.instanceForCheck.post(endpoint, {
        variables: { txIds }, // 배열로 전달
        query: `
            query getTx {
                transaction {
                    transactionResults(txIds: ${JSON.stringify(txIds)}) {
                        txStatus
                        exceptionNames
                    }
                }
            }
        `,
      });
      console.log('getTxStatus', endpoint, txIds);

      return data['data']['transaction']['transactionResults']; // 여러 결과가 배열로 반환됨
    } catch (e) {
      console.error('Error in getTxStatus:', {
        endpoint,
        txIds,
        error: e.response?.data?.errors || e.response?.data || e.message,
      });
      if (this.isErrorLogInclude('socket hang up', e)) {
        //socket hang up
        //TODO : 실패로 처리할 것인지, 재시도 허용할 것인지
        return Array(txIds.length).fill({
          txStatus: 'STAGING',
          exceptionNames: ['failed state check request : socket hang up'],
        });
      } else if (this.isErrorLogInclude('timeout', e)) {
        return Array(txIds.length).fill({
          txStatus: 'STAGING',
          exceptionNames: ['failed state check request : exceeded 20s'],
        });
      } else {
        // unknown error
        return Array(txIds.length).fill({
          txStatus: 'STAGING',
          exceptionNames: [
            'failed state check request : unknown error',
            e.response?.data?.errors || e.response?.data || e.message,
          ],
        });
      }
    }
  }

  async updateTempTx(
    endpoint_url: string,
    txHash: string,
    timeStamp: Date,
    state: string,
    log: string,
  ): Promise<void> {
    const tempTransaction = await this.getTempTransactions(
      endpoint_url,
      timeStamp,
    );
    if (!tempTransaction) {
      console.error(
        `PROBLEM! No temp transaction found for endpoint_url:  ${endpoint_url}, timeStamp: ${timeStamp}`,
      );
      return;
    }
    if (state !== 'pending') {
      console.log(
        `update TempTx from ${endpoint_url} / ${timeStamp} to state: ${state}, log: ${log}`,
      );
    }
    tempTransaction.txHash = txHash;
    tempTransaction.active = state;
    tempTransaction.log = log || '';

    try {
      await this.transactionsRepository.save(tempTransaction);
    } catch (error) {
      console.error(error);
    }
  }

  async getTempTransactions(endpoint_url: string, timestamp: Date) {
    return await this.transactionsRepository.findOne({
      where: {
        active: 'temp',
        timeStamp: timestamp,
        endpoint_url: endpoint_url,
      },
    });
  }

  async getPendingTransactions() {
    const threeDaysAgo = new Date(
      new Date().getTime() - 3 * 24 * 60 * 60 * 1000,
    ); // TODO : 일단 3일 전까지 조회하도록 설정했으나, 나중에 기준 설정 필요
    return await this.transactionsRepository.find({
      where: {
        timeStamp: MoreThan(threeDaysAgo),
        active: In(['pending', 'staging']),
      },
      select: ['id', 'endpoint_url', 'txHash', 'timeStamp'], // 필요한 필드만 선택
      order: {
        id: 'DESC',
      }, //id는 인덱스라 문제 없음
      take: 100, //최대 100개 = 오래된 id 순으로 10분 분량을 처리하는 것으로 제한하여 리소스 사용량 제한
    });
  }

  async updateCompletedTx(id: number): Promise<void> {
    await this.transactionsRepository.update(id, { active: 'true' });
  }

  async updateStagingTx(id: number): Promise<void> {
    await this.transactionsRepository.update(id, { active: 'staging' });
  }

  async updateFailedTx(
    id: number,
    log: any,
    isTimeout: boolean,
  ): Promise<void> {
    if (!id) {
      throw new Error('Transaction ID is required');
    }

    const formattedLog = Array.isArray(log)
      ? log.filter((item) => item !== null).join(', ') || 'No log provided'
      : log || 'No log provided';

    const result = await this.transactionsRepository.update(id, {
      active: isTimeout ? 'timeout' : 'false',
      log: formattedLog, // 배열을 문자열로 변환하여 저장
    });

    if (result.affected === 0) {
      console.warn(`No transaction found with ID ${id}`);
    }
  }
}

interface FungibleAssetValue {
  quantity: number;
  ticker: string;
  decimalPlaces: number;
}

interface Account {
  privateKey: string;
  address: string;
}

