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
    const commonTimestamp = new Date();
    commonTimestamp.setSeconds(0, 0);
    this.apiService.send('odin', odinRPCEndpoints, commonTimestamp);
    this.apiService.send('heimdall', heimdallRPCEndpoints, commonTimestamp);
  }

  @Get('/check')
  async checkTx() {
    this.apiService.resolvePendingTransactions();
  }

  @Get('/temp')
  async temp() {
    await this.apiService.tempSend('heimdall');
  }


}
