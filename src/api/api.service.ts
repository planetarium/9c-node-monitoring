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
import {NodeHealth} from "./db/node-health/node-health";


@Injectable()
export class ApiService {
    private endPointListURL = "https://planets.nine-chronicles.com/planets/";
    private accounts;
    private instanceForSend;
    private instanceForCheck;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly nodeHealthService: NodeHealthService
    ) {
        this.instanceForSend = axios.create({ //안정적인 비동기 전송을 위해 keepAlive 활성화
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            timeout: 5000,
        });
        this.instanceForCheck = axios.create({ //안정적인 비동기 전송을 위해 keepAlive 활성화
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            timeout: 20000,
        });
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
            try {
                const txHash = await this.sendTx(rpcEndpoints[i], action, this.accounts[i]);
                console.log('Network', rpcEndpoints[i], 'sendtx', txHash);
                console.log('Sender', sender, 'Recipient', recipient);
                await this.nodeHealthService.updateTempTx(rpcEndpoints[i], txHash, timeStamp);
            } catch (error) {
                console.error(`Error sending transaction to ${rpcEndpoints[i]}:`, error.message || error);
                await this.nodeHealthService.updateFailedTempTx(groupName, rpcEndpoints[i], timeStamp)
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

    public async findAllLostMinute(startTimeStamp: string, endTimeStamp: string, groupedData: { [key: string]: any[] }) {
        const allTimestamps = [];
        let current = new Date(startTimeStamp);
        let end = new Date(endTimeStamp);
        end.setDate(end.getDate() + 1);
        const now = new Date();

        if (end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth() + 1 && end >= now) {
            end = now;
        }

        // 각 분마다의 타임스탬프 리스트 생성 (1분 단위)
        while (current <= end) {
            allTimestamps.push(current.toISOString());
            current.setMinutes(current.getMinutes() + 1);
        }

        // 각 endpoint_url에 대한 timestamp를 기록할 Map 생성
        const endpointTimestamps = new Map<string, Set<string>>();

        // groupedData에서 각 URL과 해당 타임스탬프를 Set에 저장
        for (const [endpoint_url, data] of Object.entries(groupedData)) {
            const timestampsSet = new Set<string>();
            data.forEach(item => timestampsSet.add(new Date(item.timeStamp).toISOString()));
            endpointTimestamps.set(endpoint_url, timestampsSet);
        }

        // 모든 URL에 공통으로 존재하는 타임스탬프 찾기. 왜냐면 모든 엔드포인트에 같은 분에 보내지 않았다면 람다가 실행되지 않았기 때문!
        const commonTimestamps = [];

        for (const timestamp of allTimestamps) { // 각 타임스탬프에 대해 모든 endpoint_url에서 존재 여부 확인
            let isExist = false;

            // 각 endpoint_url에 대해 현재 timestamp가 존재하는지 확인
            for (const endpoint_url of endpointTimestamps.keys()) {
                const timestampsSet = endpointTimestamps.get(endpoint_url);

                // 특정 endpoint_url의 timestamp에 현재 timestamp가 없다면
                if (timestampsSet?.has(timestamp)) {
                    isExist = true;
                    break; // 하나라도 없으면 그 시간에 유실된 게 아니므로, 더 확인할 필요 없음
                }
            }

            // 모든 endpoint_url에 해당 timestamp가 존재한다면 commonTimestamps에 추가
            if (!isExist) {
                commonTimestamps.push(timestamp);
            }
        }
        return commonTimestamps;
    }


    public async findLostRequestDetail(startTimeStamp: string, endTimeStamp: string, groupedData: { [key: string]: any[] }) {
        const allTimestamps = [];
        let current = new Date(startTimeStamp);
        let end = new Date(endTimeStamp);
        const now = new Date();
        if(end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth() + 1 && end >= now)
            end = now;

        // 각 endpoint_url마다 체크
        while (current <= end) {
            allTimestamps.push(current.toISOString());
            current.setMinutes(current.getMinutes() + 1);  // 1분씩 증가
        }
        const missingNodesByEndpoint: { [key: string]: any[] } = {};

        // 각 endpoint_url에 대한 timestamp를 기록할 Map 생성
        const endpointTimestamps = new Map<string, Set<string>>();

        // groupedData에서 각 URL과 해당 타임스탬프를 Set에 저장
        for (const [endpoint_url, data] of Object.entries(groupedData)) {
            const timestampsSet = new Set<string>();
            data.forEach(item => timestampsSet.add(new Date(item.timeStamp).toISOString()));
            endpointTimestamps.set(endpoint_url, timestampsSet);
        }

        for (const [endpoint_url, data] of Object.entries(groupedData)) {
            // 타임스탬프를 기준으로 NodeHealth 객체를 매핑
            const timestampMap = new Map<string, NodeHealth>();
            data.forEach(item => {
                const itemTimestamp = new Date(item.timeStamp).toISOString();
                timestampMap.set(itemTimestamp, item); // timeStamp를 키로 객체 저장
            });
            const missingNodes: string[] = [];

            // 누락된 timestamp 찾기
            allTimestamps.forEach(timestamp => {
                if (!timestampMap.has(timestamp))
                    missingNodes.push(timestamp.split(':')[0] + ':' +timestamp.split(':')[1]);
            });
            if (missingNodes.length > 0) {
                missingNodesByEndpoint[endpoint_url] = missingNodes; // 누락된 노드를 저장
            }
            else
                missingNodesByEndpoint[endpoint_url] = [];
        }
        console.log(missingNodesByEndpoint);
        return missingNodesByEndpoint;
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
        const {data} = await this.instanceForSend.post(endpoint, {
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

        const { data } = await this.instanceForSend.post(endpoint, {
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
        const { data } = await this.instanceForSend.post(endpoint, {
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
        const { data } = await this.instanceForSend.post(endpoint, {
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

    async getTxStatus(endpoint: string, txIds: string[]) {
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
        `
        });
        return data['data']['transaction']['transactionResults']; // 여러 결과가 배열로 반환됨
    }

    async resolvePendingTransactions() {
        const pendingTransactions: Array<{ id: number, endpoint_url: string, txHash: string }> = await this.nodeHealthService.getPendingTransactions(); // 명시적 타입

        // endpoint_url 기준으로 그룹화
        const groupedTransactions = pendingTransactions.reduce<{ [key: string]: Array<{ id: number, endpoint_url: string, txHash: string }> }>((acc, row) => {
            if (!acc[row.endpoint_url]) {
                acc[row.endpoint_url] = [];
            }
            acc[row.endpoint_url].push(row);
            return acc;
        }, {});

        let checkEndpointUrl;
        // 각 endpoint_url 그룹별로 상태 조회 및 처리
        for (const [endpoint_url, transactions] of Object.entries(groupedTransactions)) {
            const txIds = transactions.map(tx => tx.txHash); // 해당 endpoint_url에 해당하는 txHash 배열

            if(endpoint_url.includes("heimdall"))
                checkEndpointUrl = "https://heimdall-rpc-1.nine-chronicles.com/graphql";
            else
                checkEndpointUrl = "https://odin-rpc-2.nine-chronicles.com/graphql";

            const statuses = await this.getTxStatus(checkEndpointUrl, txIds);
            // 5. 상태별로 처리
            for (const [index, status] of statuses.entries()) {
                const row = transactions[index]; // 각 상태에 대응하는 트랜잭션 정보
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
            }
        }
    }



}
interface FungibleAssetValue {
    quantity: number;
    ticker: string;
    decimalPlaces: number;
}