import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { catchError, firstValueFrom } from "rxjs";
import * as crypto from 'crypto';
import axios from "axios";
import * as secp256k1 from "secp256k1"; //"secp256k1": "^5.0.0",
import { encode, RecordView } from "@planetarium/bencodex"; //"@planetarium/bencodex": "^0.2.2",
import { ethers } from "ethers"; //"ethers": "^5.5.1";
import {NodeHealthService} from "./db/node-health/node-health.service";


@Injectable()
export class ApiService {
    private endPointListURL = "https://planets.nine-chronicles.com/planets/";
    private accounts;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly nodeHealthService: NodeHealthService
    ) {
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

    public async getRPCEndPoints() {
    const { data } = await firstValueFrom(
        this.httpService.get(this.endPointListURL).pipe(
            catchError((error: AxiosError) => {
              console.log('Error fetching transaction history:', error.message);
              throw new Error('An error occurred while fetching transaction history.');
            }),
        ),
    );
    const odinRPCEndpoints = data[0].rpcEndpoints['headless.gql'];
    const heimdallRPCEndpoints = data[1].rpcEndpoints['headless.gql'];
    return [ odinRPCEndpoints, heimdallRPCEndpoints ];
    }

    public async send(groupName: string, rpcEndpoints: string[], timeStamp: Date) {
        for (let i = 0; i < rpcEndpoints.length; i++) {
            if(i >= this.accounts.length) //만약 엔드포인트가 훨씬 더 늘어났을 경우 계정 생성 바람.
                break;
            const sender =   this.accounts[i].address;
            const recipient = this.accounts[(i + 1) % rpcEndpoints.length].address; // 다음사람한테 주기.
            let action;
            if(groupName === 'odin')
                action = this.makeTransferInOdin(sender, recipient);
            else
                action = this.makeTransferInHeimdall(sender, recipient);
            const txHash = await this.sendTx(rpcEndpoints[i], action, this.accounts[i]);
            console.log('Network', rpcEndpoints[i],'sendtx', txHash);
            console.log('Sender', sender, 'Recipient', recipient);
            await this.nodeHealthService.savePendingTx(groupName, rpcEndpoints[i], txHash, timeStamp)
        }
    }

    public async tempSend(groupName: string) {
        const endpoint = 'https://heimdall-rpc-3.nine-chronicles.com/graphql';
        const sender =   this.accounts[2].address;
        const recipient = this.accounts[1].address; // 다음사람한테 주기.
        const action = Buffer.from(encode(new RecordView({
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
                    10n,
                ],
                recipient: this.hexToBuffer(recipient),
                sender: this.hexToBuffer(sender),
            }
        }, 'text'))).toString('hex');
        const txHash = await this.sendTx(endpoint, action, this.accounts[2]);
        console.log('Network', endpoint,'sendtx', txHash);
        console.log('Sender', sender, 'Recipient', recipient);
        await this.waitForTx(endpoint, txHash);
    }

    private makeTransferInOdin(sender: string, recipient: string) {
        return Buffer.from(encode(new RecordView({
            type_id: 'transfer_asset5',
            values: {
                amount: [
                    new RecordView(
                        {
                            decimalPlaces: Buffer.from([0x02]),
                            minters: [this.hexToBuffer("0x47d082a115c63e7b58b1532d20e631538eafadde")],
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
        return Buffer.from(
            ethers.utils.arrayify(hex, { allowMissingPrefix: true })
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

    async sendTx(endpoint: string, action: string, account): Promise<string | undefined> {
        const wallet = new ethers.Wallet(account.privateKey);
        const nonce = await this.nextTxNonce(endpoint, account.address);
        const _unsignedTx = await this.unsignedTx(endpoint, wallet.publicKey.slice(2), action, nonce);
        const unsignedTxId = crypto.createHash('sha256').update(_unsignedTx, 'hex').digest();
        const { signature } = secp256k1.ecdsaSign(this.pad32(unsignedTxId), this.hexToBuffer(wallet.privateKey));
        const sign = Buffer.from(secp256k1.signatureExport(signature));
        const { data: { transaction: { signTransaction: signTx } } } = await this.signTransaction(endpoint, _unsignedTx, sign.toString('hex'));
        const { txId } = await this.stageTx(endpoint, signTx);
        return txId;
    }

    async temp() {
        const endpoint = "https://heimdall-rpc-3.nine-chronicles.com/graphql"
        const wallet = new ethers.Wallet("3b9175a19d4bb549cb2c1c7dc8a996046bf96e2594d07a6fe5d2e8e93cc23a11");
        // console.log(wallet.publicKey)
        const _unsignedTx = "64313a616c6475373a747970655f69647531343a617070726f76655f706c6564676575363a76616c75657332303ac64c7cbf29bf062acc26024d5b9d1648e8f8d2e16565313a6733323a729fa26958648a35b53e8e3905d11ec53b1b4929bf5f499884aed7df616f5913313a6c693165313a6d6c647531333a646563696d616c506c61636573313a1275373a6d696e746572736e75363a7469636b657275343a4d6561646569313030303030303030303030303030303030306565313a6e69313565313a7036353a04a1e0c1d5c525e03b816fdbfa80789b1115826e399bef217787074820085a37868d88d66de8282cfc77d290eebcb9373f0a1acebf6847197b1d219b2ef389b4f1313a7332303a1710caab236de8fe3a55a1a8744cc1e40cad5705313a747532373a323032342d31302d31305430313a34383a34302e3436323433355a313a756c6565";
        const unsignedTxId = crypto.createHash('sha256').update(_unsignedTx, 'hex').digest();
        const { signature } = secp256k1.ecdsaSign(this.pad32(unsignedTxId), this.hexToBuffer(wallet.privateKey));
        const sign = Buffer.from(secp256k1.signatureExport(signature));
        const { data: { transaction: { signTransaction: signTx } } } = await this.signTransaction(endpoint, _unsignedTx, sign.toString('hex'));
        const { txId } = await this.stageTx(endpoint, signTx);
        await this.waitForTx(endpoint, txId);
    }

    async nextTxNonce(endpoint: string, address: string): Promise<number> {
        let {data} = await axios.create({timeout: 10000})({
            method: "POST",
            url: endpoint,
            data: {
                variables: {address},
                query: `
              query getNextTxNonce($address: Address!){
                transaction{
                    nextTxNonce(address: $address)
                }
              }
            `,
            },
        });
        return data["data"]["transaction"]["nextTxNonce"];
    }


    async unsignedTx(endpoint: string, publicKey: string, plainValue: string, nonce: number): Promise<string> {
        const maxGasPrice: FungibleAssetValue = {
            quantity: 1,
            ticker: 'Mead',
            decimalPlaces: 18
        };

        let { data } = await axios({
            method: "POST",
            url: endpoint,
            data: {
                variables: { publicKey, plainValue, nonce, maxGasPrice },
                query: `
                query unsignedTx($publicKey: String!, $plainValue: String!, $nonce: Long, $maxGasPrice: FungibleAssetValueInputType) {
                  transaction {
                    unsignedTransaction(publicKey: $publicKey, plainValue: $plainValue nonce: $nonce, maxGasPrice: $maxGasPrice)
                  }
                }
              `,
            },
        });

        if (data['errors']) {
            console.error(data['errors']);
            throw data;
        }
        return data["data"]["transaction"]["unsignedTransaction"];
    }

    async signTransaction(endpoint: string, unsignedTx: string, base64Sign: string): Promise<any> {
        let { data } = await axios({
            method: 'POST',
            url: endpoint,
            data: {
                "variables": { unsignedTx, signature: base64Sign },
                "query": `
                  query attachSignature($unsignedTx: String!, $signature: String!) {
                    transaction {
                      signTransaction(unsignedTransaction: $unsignedTx, signature: $signature)
                    }
                  }
                `
            }
        });
        return data;
    }

    async stageTx(endpoint: string, payload: string): Promise<{ txId: string }> {
        let {data} = await axios({
            method: "POST",
            url: endpoint,
            data: {
                variables: {payload},
                query: `
            mutation transfer($payload: String!) {
              stageTransaction(payload: $payload)
            }
          `,
            },
        });
        try {
            return {txId: data["data"]["stageTransaction"]};
        } catch (e) {
            console.log(e, data);
            throw e;
        }
    }

    async getTxStatus(endpoint: string, txId: string) {
        let { data } = await axios({
            method: 'POST',
            url: endpoint,
            data: {
                "variables": { txId },
                "query": `
                  query getTx {
                    transaction {
                      transactionResult(txId: "${txId}") {
                        txStatus
                        exceptionNames
                      }
                    }
                  }
                `
            }
        });
        return data['data']['transaction']['transactionResult'];
    }

    async resolvePendingTransactions() {
        const pendingTransactions = await this.nodeHealthService.getPendingTransactions();

        const statusPromises = pendingTransactions.map(async (row) => {
            const status = await this.getTxStatus(row.endpoint_url, row.txHash);
            return {
                id: row.id,
                status,
            };
        });

        // 한 번에 비동기로 쫙 보내고, 결과 처리 같이 하기.
        const results = await Promise.all(statusPromises);

        // 결과 처리
        results.forEach(result => {
            if(result.status.txStatus === 'SUCCESS')
                this.nodeHealthService.updateCompletedTx(result.id);
            else
                this.nodeHealthService.updateFailedTx(result.id, result.status.exceptionNames);
            console.log(result);
        });
    }

async waitForTx(endpoint: string, txId: string): Promise<string | undefined> {
    console.log(`Waiting TX: ${txId}`);
    for (let i = 0; i < 60; i++) {
        const { txStatus } = await this.getTxStatus(endpoint, txId);
        if (txStatus === 'SUCCESS' || txStatus === 'FAILURE') {
            console.log(`${txStatus}: ${txId}`);
            return txStatus;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.error('Timeout');
}

}
interface FungibleAssetValue {
    quantity: number;
    ticker: string;
    decimalPlaces: number;
}