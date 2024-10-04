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


@Injectable()
export class ApiService {
  private endPointListURL = "https://planets.nine-chronicles.com/planets/";
  private RPC: string = 'https://odin-rpc-1.nine-chronicles.com/graphql';
  private ACCOUNT: string = '0x1710caAb236dE8fE3a55a1a8744CC1E40cad5705';
  private PRIVATE_KEY: string = this.configService.get('privateKey');

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  public async getRPCEndPoints() {
    const { data } = await firstValueFrom(
        this.httpService.get(this.endPointListURL).pipe(
            catchError((error: AxiosError) => {
              console.log('Error fetching transaction history:', error.message);
              throw new Error('An error occurred while fetching transaction history.');
            }),
        ),
    );
    const odinRPCEndpoints = data[0].rpcEndpoints;
    const heimdallRPCEndpoints = data[1].rpcEndpoints;
    return [ odinRPCEndpoints, heimdallRPCEndpoints ];
  }

  public async test() {
      const action = Buffer.from(encode(new RecordView({
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
              recipient: this.hexToBuffer('0x8b95b71abf224b77910ce598ca807f21df231801'),
              sender: this.hexToBuffer(this.ACCOUNT),
          }
      }, 'text'))).toString('hex');
      const tx = await this.sendTx(action);
      console.log('send tx', tx);
      await this.waitForTx(tx!);
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

    async sendTx(action: string): Promise<string | undefined> {
        const wallet = new ethers.Wallet(this.PRIVATE_KEY);
        const nonce = await this.nextTxNonce(this.ACCOUNT);
        const _unsignedTx = await this.unsignedTx(wallet.publicKey.slice(2), action, nonce);
        const unsignedTxId = crypto.createHash('sha256').update(_unsignedTx, 'hex').digest();
        const { signature } = secp256k1.ecdsaSign(this.pad32(unsignedTxId), this.hexToBuffer(wallet.privateKey));
        const sign = Buffer.from(secp256k1.signatureExport(signature));
        const { data: { transaction: { signTransaction: signTx } } } = await this.signTransaction(_unsignedTx, sign.toString('hex'));
        const { txId } = await this.stageTx(signTx);
        return txId;
    }

    async nextTxNonce(address: string): Promise<number> {
        let { data } = await axios.create({ timeout: 10000 })({
            method: "POST",
            url: this.RPC,
            data: {
                variables: { address },
                query: `
              query getNextTxNonce($address: Address!){
                transaction{
                    nextTxNonce(address: $address)
                }
              }
            `,
            },
        });
        console.log(data)
        return data["data"]["transaction"]["nextTxNonce"];
    }


async unsignedTx(publicKey: string, plainValue: string, nonce: number): Promise<string> {
    const maxGasPrice: FungibleAssetValue = {
        quantity: 1,
        ticker: 'Mead',
        decimalPlaces: 18
    };

    let { data } = await axios({
        method: "POST",
        url: this.RPC,
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

async signTransaction(unsignedTx: string, base64Sign: string): Promise<any> {
    let { data } = await axios({
        method: 'POST',
        url: this.RPC,
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

async stageTx(payload: string): Promise<{ txId: string }> {
    let { data } = await axios({
        method: "POST",
        url: this.RPC,
        data: {
            variables: { payload },
            query: `
            mutation transfer($payload: String!) {
              stageTransaction(payload: $payload)
            }
          `,
        },
    });
    try {
        return { txId: data["data"]["stageTransaction"] };
    } catch (e) {
        console.log(e, data);
        throw e;
    }
}

async getTxStatus(txId: string): Promise<{ txStatus: string }> {
    let { data } = await axios({
        method: 'POST',
        url: this.RPC,
        data: {
            "variables": { txId },
            "query": `
              query getTx {
                transaction {
                  transactionResult(txId: "${txId}") {
                    txStatus
                  }
                }
              }
            `
        }
    });
    return data['data']['transaction']['transactionResult'];
}

async waitForTx(txId: string): Promise<string | undefined> {
    console.log(`Waiting TX: ${txId}`);
    for (let i = 0; i < 60; i++) {
        const { txStatus } = await this.getTxStatus(txId);
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