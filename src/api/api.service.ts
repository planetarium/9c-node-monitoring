import { Injectable } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import axiosRetry from 'axios-retry'; 
import * as crypto from 'crypto';
import axios, { AxiosInstance } from "axios";
import * as secp256k1 from "secp256k1"; // "secp256k1": "^5.0.0",
import { encode, RecordView } from "@planetarium/bencodex"; // "@planetarium/bencodex": "^0.2.2",
import { ethers } from "ethers"; // "ethers": "^5.5.1";
import { NodeHealthService } from "./db/node-health/node-health.service";
import * as https from "node:https";
import * as http from "node:http";


@Injectable()
export class ApiService {
    private readonly MAX_RETRY_COUNT: number = 3;
    private endPointListURL = 'https://planets.nine-chronicles.com/planets/';
    private accounts;
    private instanceForSend: AxiosInstance;
    private instanceForCheck: AxiosInstance;
    private readonly logger = new Logger(ApiService.name);
    private readonly TIMEOUT = 120000;
    private readonly MAX_PARALLEL_REQUESTS: number = 4;

    constructor(
        private readonly configService: ConfigService,
        private readonly nodeHealthService: NodeHealthService
    ) {
        // 전역 Axios 인스턴스 생성
        this.instanceForSend = axios.create({
            timeout: this.TIMEOUT,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            headers: { "Connection": "keep-alive" },
        });
    
        axiosRetry(this.instanceForSend, {
            retries: 7,
            retryDelay: (retryCount) => {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 60000);
                this.logger.warn(`Retrying request... Attempt #${retryCount}, Delay: ${delay}ms`);
                return delay;
            },
            retryCondition: (error: AxiosError) =>
                axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                ['ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED'].includes(error.code) ||
                error.message.includes("timeout") || 
                (error.response?.status ?? 0) >= 500,
        });
        this.instanceForCheck = axios.create({
            timeout: this.TIMEOUT,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            headers: { "Connection": "keep-alive" },
        });

        // accounts 초기화
        this.initializeAccounts();
    }
          
    private initializeAccounts() {
        this.accounts = [
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_0'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_0'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_1'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_1'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_2'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_2'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_3'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_3'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_4'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_4'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_5'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_5'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_6'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_6'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_7'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_7'),
            },
            {
                privateKey: this.configService.get<string>('PRIVATE_KEY_8'),
                address: this.configService.get<string>('ACCOUNT_ADDRESS_8'),
            }
        ];
    }

    public async getRPCEndPoints(): Promise<[string[], string[]]> {
        try {
            const { data } = await this.instanceForSend.get(this.endPointListURL, {
                timeout: this.TIMEOUT,
            });
    
            if (!data || !Array.isArray(data) || data.length < 2) {
                throw new Error("Invalid response format from endpoint list API.");
            }
    
            const odinRPCEndpoints = data[0]?.rpcEndpoints?.['headless.gql'] || [];
            const heimdallRPCEndpoints = data[1]?.rpcEndpoints?.['headless.gql'] || [];
    
            if (!odinRPCEndpoints.length || !heimdallRPCEndpoints.length) {
                throw new Error("Missing endpoints from the response.");
            }
    
            return [odinRPCEndpoints, heimdallRPCEndpoints];
        } catch (error) {
            this.logger.error('Error in getRPCEndPoints:', error.message);
            throw new Error(`Failed to fetch RPC endpoints: ${error.message}`);
        }
    }

      async sendWithRetry(groupName: string, rpcEndpoints: string[], timeStamp: Date): Promise<void> {
        console.log(`Starting sendWithRetry for ${groupName} at ${new Date()}`);
        const batchedEndpoints = this.chunkArray(rpcEndpoints, this.MAX_PARALLEL_REQUESTS);
    
        for (const batch of batchedEndpoints) {
            try {
                await Promise.all(batch.map(async (endpoint, i) => {
                    if (i >= this.accounts.length) return;
    
                    const sender = this.accounts[i].address;
                    const recipient = this.accounts[(i + 1) % this.accounts.length].address;
                    const action = groupName === 'odin' 
                        ? this.makeTransferInOdin(sender, recipient) 
                        : this.makeTransferInHeimdall(sender, recipient);
    
                    const txHash = await this.sendTx(endpoint, action, this.accounts[i]);
                    console.log('Network', endpoint, 'sendtx', txHash);
                    await this.nodeHealthService.updateTempTx(endpoint, txHash, timeStamp);
                }));
            } catch (error) {
                console.error(`[sendWithRetry] Error while sending batch:`, error.message || error);
            }
            await this.delay(500); // Batch 간 지연
        }
    }
    

    private chunkArray(array: any[], size: number): any[][] {
        return array.reduce((resultArray, item, index) => {
            const chunkIndex = Math.floor(index / size);
            if (!resultArray[chunkIndex]) {
                resultArray[chunkIndex] = [];
            }
            resultArray[chunkIndex].push(item);
            return resultArray;
        }, []);
    }
    
    
      private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      

      private async send(groupName: string, rpcEndpoints: string[], timeStamp: Date): Promise<void> {
        // 병렬로 모든 rpcEndpoints에 트랜잭션 전송
        await Promise.all(rpcEndpoints.map(async (endpoint, i) => {
            if (i >= this.accounts.length) return;

            const sender = this.accounts[i].address;
            const recipient = this.accounts[(i + 1) % this.accounts.length].address;
            const action = groupName === 'odin' ? this.makeTransferInOdin(sender, recipient) : this.makeTransferInHeimdall(sender, recipient);

            try {
                const txHash = await this.sendTx(endpoint, action, this.accounts[i]);
                console.log('Network', endpoint, 'sendtx', txHash);
                await this.nodeHealthService.updateTempTx(endpoint, txHash, timeStamp);
            } catch (error) {
                console.error(`Error sending transaction to ${endpoint}:`, error.message || error);
                throw error;
            }
        }));
    }

    async resolvePendingTransactionsWithRetry(): Promise<void> {
        for (let retry = 0; retry < this.MAX_RETRY_COUNT; retry++) {
            try {
                await this.resolvePendingTransactions();
                break;
            } catch (error) {
                console.error(`[RetryTx] Error resolving pending transactions. Attempt ${retry + 1}`, error.message);
                if (retry === this.MAX_RETRY_COUNT - 1) throw error;
                await this.delay(5000 * (retry + 1)); 
            }
        }
    }

    public async saveTemp(groupName: string, rpcEndpoints: string[], timeStamp: Date) {
        for (let i = 0; i < rpcEndpoints.length; i++) {
            if(i >= this.accounts.length) //만약 엔드포인트가 훨씬 더 늘어났을 경우 계정 생성 바람.
                break;
            await this.nodeHealthService.saveTempTx(groupName, rpcEndpoints[i], timeStamp);
        }
    }

    public async findAllLostMinute(groupedData: { [key: string]: any[] }) {
        const commonTimestamps = [];
        // groupedData에서 각 URL과 해당 타임스탬프를 Set에 저장
        for (const [endpoint_url, data] of Object.entries(groupedData)) {
            data.forEach(item => commonTimestamps.push({endpoint_url: endpoint_url, timestamp: new Date(item.timeStamp).toISOString()}));
        }
        console.log(commonTimestamps);
        return commonTimestamps;
    }


    public async groupingLostRequestDetail(groupedData: { [key: string]: any[] }) {
        const missingNodesByEndpoint: { [key: string]: any[] } = {};

        for (const [endpoint_url, data] of Object.entries(groupedData)) {
            const missingNodes: string[] = [];

            data.forEach(item => {
                const timestamp = item.timeStamp.toISOString();
                missingNodes.push(timestamp.split(':')[0] + ':' + timestamp.split(':')[1]);
            });
            if (missingNodes.length > 0) {
                missingNodesByEndpoint[endpoint_url] = missingNodes; // 누락된 노드를 저장
            }
            else
                missingNodesByEndpoint[endpoint_url] = [];
        }
        return missingNodesByEndpoint;
    }

    private makeTransferInOdin(sender: string, recipient: string) {
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
                        minters: [this.hexToBuffer('0x47d082a115c63e7b58b1532d20e631538eafadde')],
                        ticker: 'NCG',
                      },
                      'text',
                    ),
                    1n,
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

    private makeTransferInHeimdall(sender: string, recipient: string) {
        return Buffer.from(encode(new RecordView({
            type_id: 'transfer_asset5',
            values: {
                amount: [
                    new RecordView(
                        {
                            decimalPlaces: Buffer.from([0x02]),
                            minters: null,
                            ticker: "NCG",
                        },
                        "text"
                    ),
                    1n,
                ],
                recipient: this.hexToBuffer(recipient),
                sender: this.hexToBuffer(sender),
            }
        }, 'text'))).toString('hex');
    }

    hexToBuffer(hex: string): Buffer {
        return Buffer.from(ethers.utils.arrayify(hex, { allowMissingPrefix: true }));
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

    async sendTx(endpoint: string, action: string, account): Promise<string | undefined> {
        const wallet = new ethers.Wallet(account.privateKey);
        const nonce = await this.nextTxNonce(endpoint, account.address);
      
        const unsignedTx = await this.unsignedTx(endpoint, wallet.publicKey.slice(2), action, nonce);
        const unsignedTxId = crypto.createHash('sha256').update(unsignedTx, 'hex').digest();
        const { signature } = secp256k1.ecdsaSign(this.pad32(unsignedTxId), this.hexToBuffer(wallet.privateKey));
        const sign = Buffer.from(secp256k1.signatureExport(signature));
      
        const { data: { transaction: { signTransaction: signTx } } } = await this.signTransaction(endpoint, unsignedTx, sign.toString('hex'));
      
        const { txId } = await this.stageTx(endpoint, signTx);
        return txId;
      }

      

      


      async nextTxNonce(endpoint: string, address: string): Promise<number> {
        const { data } = await this.instanceForSend.post(
          endpoint,
          {
            variables: { address },
            query: `
              query getNextTxNonce($address: Address!) {
                transaction {
                  nextTxNonce(address: $address)
                }
              }
            `,
          },
          { timeout: this.TIMEOUT }
        );
        return data.data.transaction.nextTxNonce;
      }


      async unsignedTx(endpoint: string, publicKey: string, plainValue: string, nonce: number): Promise<string> {
        const maxGasPrice: FungibleAssetValue = {
          quantity: 1,
          ticker: 'Mead',
          decimalPlaces: 18,
        };
      
        const { data } = await this.instanceForSend.post(
          endpoint,
          {
            variables: { publicKey, plainValue, nonce, maxGasPrice },
            query: `
              query unsignedTx(
                $publicKey: String!,
                $plainValue: String!,
                $nonce: Long,
                $maxGasPrice: FungibleAssetValueInputType
              ) {
                transaction {
                  unsignedTransaction(
                    publicKey: $publicKey,
                    plainValue: $plainValue,
                    nonce: $nonce,
                    maxGasPrice: $maxGasPrice
                  )
                }
              }
            `,
          },
          { timeout: this.TIMEOUT }
        );
        return data["data"]["transaction"]["unsignedTransaction"];
      }

      async signTransaction(endpoint: string, unsignedTx: string, base64Sign: string): Promise<any> {
        const { data } = await this.instanceForSend.post(
          endpoint,
          {
            variables: { unsignedTx, signature: base64Sign },
            query: `
              query attachSignature($unsignedTx: String!, $signature: String!) {
                transaction {
                  signTransaction(unsignedTransaction: $unsignedTx, signature: $signature)
                }
              }
            `,
          },
          { timeout: this.TIMEOUT }
        );
        return data;
      }

      async stageTx(endpoint: string, payload: string): Promise<{ txId: string }> {
        try {
          const { data } = await this.instanceForSend.post(
            endpoint,
            {
              variables: { payload },
              query: `
                mutation transfer($payload: String!) {
                  stageTransaction(payload: $payload)
                }
              `,
            },
            { timeout: this.TIMEOUT }
          );
          return { txId: data["data"]["stageTransaction"] };
        } catch (e) {
          console.error(`Error staging transaction at ${endpoint}:`, e.response?.data || e.message);
          throw new Error(`Transaction staging failed for ${endpoint}. Details: ${e.message}`);
        }
      }

      private async getTxStatus(endpoint: string, txIds: string[]): Promise<any[]> {
        const BATCH_SIZE = 3;
        const batchedTxIds = this.chunkArray(txIds, BATCH_SIZE);
        const results = [];
    
        for (const batch of batchedTxIds) {
            try {
                const { data } = await this.instanceForCheck.post(
                    endpoint,
                    {
                        variables: { txIds: batch },
                        query: `
                          query getTx {
                            transaction {
                              transactionResults(txIds: ${JSON.stringify(batch)}) {
                                txStatus
                                exceptionNames
                              }
                            }
                          }
                        `,
                    },
                    { timeout: this.TIMEOUT }
                );
                results.push(...data['data']['transaction']['transactionResults']);
            } catch (error) {
                console.error(
                    `[GetTxStatus] Failed fetching status for Endpoint: ${endpoint}, TxIDs: ${batch}, Status Code: ${error.response?.status}`,
                    error.response?.data || error.message
                );
                await Promise.all(
                    batch.map(async (txId) => {
                        const failedTx = await this.nodeHealthService.findTransactionByTxHash(txId);
                        if (failedTx) {
                            await this.nodeHealthService.updateFailedTx(failedTx.id, error.message);
                        }
                    })
                );
                continue; // 오류 발생 시 강제 중단 방지
            }
        }
        return results;
    }

      async findTransactionByTxHash(txHash: string) {
        return await this.nodeHealthService.findTransactionByTxHash(txHash);
      }



      async resolvePendingTransactions(): Promise<void> {
        const pendingTransactions = await this.nodeHealthService.getPendingTransactions();
    
        // 엔드포인트별로 트랜잭션 그룹핑
        const groupedTransactions: Record<string, typeof pendingTransactions> = pendingTransactions.reduce(
            (acc, row) => {
                if (!acc[row.endpoint_url]) {
                    acc[row.endpoint_url] = [];
                }
                acc[row.endpoint_url].push(row);
                return acc;
            },
            {} as Record<string, typeof pendingTransactions>
        );
    
        // 엔드포인트별 트랜잭션 확인
        for (const [endpoint_url, transactions] of Object.entries(groupedTransactions)) {
            const txIds = transactions.map((tx) => tx.txHash);
    
            const checkEndpointUrl = endpoint_url.includes("heimdall")
                ? "https://heimdall-rpc-1.nine-chronicles.com/graphql"
                : "https://odin-rpc-2.nine-chronicles.com/graphql";
    
            try {
                // 트랜잭션 확인 병렬 처리 개선
                await Promise.allSettled(
                    txIds.map(async (txId, index) => {
                        try {
                            const status = await this.getTxStatus(checkEndpointUrl, [txId]);
                            const transaction = transactions[index];
    
                            if (status[0]?.txStatus === "SUCCESS") {
                                await this.nodeHealthService.updateCompletedTx(transaction.id);
                                console.log(`[TxStatus] SUCCESS: 트랜잭션 ${txId} 완료 (${checkEndpointUrl})`);
                            } else if (status[0]?.txStatus === "STAGING") {
                                await this.nodeHealthService.updateStagingTx(transaction.id);
                                console.log(`[TxStatus] STAGING: 트랜잭션 ${txId} 스테이징 중 (${checkEndpointUrl})`);
                            } else {
                                await this.nodeHealthService.updateFailedTx(
                                    transaction.id,
                                    status[0]?.exceptionNames || "알 수 없는 오류"
                                );
                                console.error(
                                    `[TxStatus] FAILED: 트랜잭션 ${txId} 실패 (${checkEndpointUrl}). 사유: ${status[0]?.exceptionNames || "알 수 없음"}`
                                );
                            }
                        } catch (error) {
                            console.error(`[TxStatus] ERROR: 트랜잭션 ${txId} 확인 실패. 오류: ${error.message}`);
                            await this.nodeHealthService.updateFailedTx(transactions[index].id, error.message);
                        }
                    })
                );
    
                console.log(`[ResolveTx] 트랜잭션 확인 성공 (${checkEndpointUrl})`);
            } catch (error) {
                console.error(`[ResolveTx] Final failure after retries for ${endpoint_url}:`, error.message);
            }
        }
    }
 }
    
interface FungibleAssetValue {
    quantity: number;
    ticker: string;
    decimalPlaces: number;
}