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
import * as https from "node:https";
import * as http from "node:http";


@Injectable()
export class ApiService {
    private endPointListURL = "https://planets.nine-chronicles.com/planets/";
    private accounts;
    private instance;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly nodeHealthService: NodeHealthService
    ) {
        this.instance = axios.create({ //안정적인 비동기 전송을 위해 keepAlive 활성화
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            timeout: 30000,  // 타임아웃을 늘림
        });
        const addresses = process.env.addresses.split(',');
        const privatekeys = process.env.privatekeys.split(',');
        this.accounts = [
            {
                privateKey: privatekeys[0],
                address: addresses[0],
            },
            {
                privateKey: privatekeys[1],
                address: addresses[1],
            },
            {
                privateKey: privatekeys[2],
                address: addresses[2],
            },
            {
                privateKey: privatekeys[3],
                address: addresses[3],
            },
            {
                privateKey: privatekeys[4],
                address: addresses[4],
            },
            {
                privateKey: privatekeys[5],
                address: addresses[5],
            },
            {
                privateKey: privatekeys[6],
                address: addresses[6],
            },
            {
                privateKey: privatekeys[7],
                address: addresses[7],
            },
            {
                privateKey: privatekeys[8],
                address: addresses[8],
            },
        ];
    }

    public async getRPCEndPoints() {
        const {data} = await firstValueFrom(
            this.httpService.get(this.endPointListURL).pipe(
                catchError((error: AxiosError) => {
                    console.log('Error fetching transaction history:', error.message);
                    throw new Error('An error occurred while fetching transaction history.');
                }),
            ),
        );
        const odinRPCEndpoints = data[0].rpcEndpoints['headless.gql'];
        const heimdallRPCEndpoints = data[1].rpcEndpoints['headless.gql'];
        return [odinRPCEndpoints, heimdallRPCEndpoints];
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


    async nextTxNonce(endpoint: string, address: string): Promise<number> {
        const {data} = await this.instance.post(endpoint, {
            variables: {address},
            query: `
              query getNextTxNonce($address: Address!){
                transaction{
                    nextTxNonce(address: $address)
                }
              }
            `})
        return data["data"]["transaction"]["nextTxNonce"];
    }


    async unsignedTx(endpoint: string, publicKey: string, plainValue: string, nonce: number): Promise<string> {
        const maxGasPrice: FungibleAssetValue = {
            quantity: 1,
            ticker: 'Mead',
            decimalPlaces: 18
        };

        const { data } = await this.instance.post(endpoint, {
            variables: { publicKey, plainValue, nonce, maxGasPrice },
            query: `
                query unsignedTx($publicKey: String!, $plainValue: String!, $nonce: Long, $maxGasPrice: FungibleAssetValueInputType) {
                  transaction {
                    unsignedTransaction(publicKey: $publicKey, plainValue: $plainValue nonce: $nonce, maxGasPrice: $maxGasPrice)
                  }
                }
              `})
        return data["data"]["transaction"]["unsignedTransaction"];
    }

    async signTransaction(endpoint: string, unsignedTx: string, base64Sign: string): Promise<any> {
        const { data } = await this.instance.post(endpoint, {
            "variables": { unsignedTx, signature: base64Sign },
            "query": `
                  query attachSignature($unsignedTx: String!, $signature: String!) {
                    transaction {
                      signTransaction(unsignedTransaction: $unsignedTx, signature: $signature)
                    }
                  }
                `
        })
        return data;
    }

    async stageTx(endpoint: string, payload: string): Promise<{ txId: string }> {
        const { data } = await this.instance.post(endpoint, {
            variables: {payload},
            query: `
            mutation transfer($payload: String!) {
              stageTransaction(payload: $payload)
            }
          `
        })
        try {
            return {txId: data["data"]["stageTransaction"]};
        } catch (e) {
            console.log(e, data);
            throw e;
        }
    }

    async getTxStatus(endpoint: string, txId: string) {

        const { data } = await this.instance.post(endpoint, {
            variables: { txId },
            query: `
                  query getTx {
                    transaction {
                      transactionResult(txId: "${txId}") {
                        txStatus
                        exceptionNames
                      }
                    }
                  }
                `
        })
        return data['data']['transaction']['transactionResult'];
    }

    async resolvePendingTransactions() {
        const pendingTransactions = await this.nodeHealthService.getPendingTransactions();

        for (const row of pendingTransactions) {
            const status = await this.getTxStatus(row.endpoint_url, row.txHash);
            const result = {
                id: row.id,
                status,
            };

            if (result.status.txStatus === 'SUCCESS') {
                await this.nodeHealthService.updateCompletedTx(result.id);
            } else if (result.status.txStatus === 'STAGING') {
                await this.nodeHealthService.updateStagingTx(result.id);
            } else {
                await this.nodeHealthService.updateFailedTx(result.id, result.status.exceptionNames);
            }
            console.log(result);
        }
    }


}
interface FungibleAssetValue {
    quantity: number;
    ticker: string;
    decimalPlaces: number;
}