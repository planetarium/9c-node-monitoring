import { Inject, Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { catchError, firstValueFrom } from "rxjs";
import { Contract, ethers, EtherscanProvider, Wallet } from "ethers";
import { Mutex } from "async-mutex";
import { SepoliaService } from "./transaction/sepolia/sepolia.service";


@Injectable()
export class ApiService {
  private sepoliaProvider = new EtherscanProvider('sepolia', this.configService.get('SEPOLIA_API_KEY'));
  private bnbProvider = new EtherscanProvider('bnbt', this.configService.get('BNBSCAN_API_KEY'));
  private sepoliaContractAddress = this.configService.get('sepoliaContractAddress');
  private bnbContractAddress = this.configService.get('bnbContractAddress');

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

}
