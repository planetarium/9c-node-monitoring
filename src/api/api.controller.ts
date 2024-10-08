import { Controller, Get, Query } from "@nestjs/common";
import { ApiService } from "./api.service";


@Controller('/api')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('/endpoint')
  async getRpcEndPoints() {
    return await this.apiService.getRPCEndPoints();
  }

  @Get('/send')
  async send() {
    const [ odinRPCEndpoints, heimdallRPCEndpoints ] = await this.apiService.getRPCEndPoints();
    this.apiService.send('odin', odinRPCEndpoints);
    this.apiService.send('heimdall', heimdallRPCEndpoints);
  }

  @Get('/check')
  async checkTx(@Query('endpoint') endpoint: string, @Query('txHash') txHash: string) {
    const { txStatus } = await this.apiService.getTxStatus(endpoint, txHash);
    if (txStatus === 'SUCCESS' || txStatus === 'FAILURE') {
      console.log(`${txStatus}: ${txHash}`);
      return txStatus;
    }
  }

}
