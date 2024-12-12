import { Controller, Get, Query, Post, Body } from "@nestjs/common";
import { ApiService } from "./api.service";
import {NodeHealthService} from "./db/node-health/node-health.service";


interface SendTransactionDto {
  groupName: string;
  rpcEndpoints: string[];
  timeStamp: Date;
}

@Controller('/api')
export class ApiController {
  constructor(
    private readonly apiService: ApiService,
    private readonly nodeHealthService: NodeHealthService
  ) {}

  @Get('/resolve-pending')
  async resolvePendingTransactions(): Promise<void> {
    console.log("Resolving pending transactions...");
    await this.apiService.resolvePendingTransactionsWithRetry();
    console.log("Pending transactions resolved.");
  }


  @Post('/send-tx')
  async handleSendTransaction(@Body() body: SendTransactionDto): Promise<void> {
    const { groupName, rpcEndpoints, timeStamp } = body;
    console.log(`Received request to send transactions for group: ${groupName}`);
    await this.apiService.saveTemp(groupName, rpcEndpoints, new Date(timeStamp));
    await this.apiService.sendWithRetry(groupName, rpcEndpoints, new Date(timeStamp));
  }

  @Get('/endpoint')
  async getRpcEndPoints() {
    return await this.apiService.getRPCEndPoints();
  }

  @Get('/send')
  async send(): Promise<void> {
    const [odinRPCEndpoints, heimdallRPCEndpoints] = await this.apiService.getRPCEndPoints();
    const commonTimestamp = new Date();
    commonTimestamp.setSeconds(0, 0);
    commonTimestamp.setHours(commonTimestamp.getHours() + 9);
    await this.apiService.saveTemp('odin', odinRPCEndpoints, commonTimestamp);
    await this.apiService.saveTemp('heimdall', heimdallRPCEndpoints, commonTimestamp);
    await this.apiService.sendWithRetry('odin', odinRPCEndpoints, commonTimestamp);
    await this.apiService.sendWithRetry('heimdall', heimdallRPCEndpoints, commonTimestamp);
  }
  

  @Get('/check')
  async checkTx(): Promise<void> {
    await this.apiService.resolvePendingTransactionsWithRetry();
  }


  @Get('/status')
  async getStatus() {
    return await this.nodeHealthService.getStatus();
  }

  @Get(`/status/detail`)
  async getDetail(@Query("group") group: string, @Query("start") startTimeStamp: string, @Query("end") endTimeStamp: string) {
    let details = await this.nodeHealthService.getDetail(group, startTimeStamp, endTimeStamp);
    const groupedData = details.reduce((acc, item) => {
      const endpoint = item.endpoint_url;
      if (!acc[endpoint]) {
        acc[endpoint] = [];
      }
      acc[endpoint].push(item);
      return acc;
    }, {});
    return groupedData;
  }

  @Get(`/status/lost`)
  async getLost(@Query("group") group: string, @Query("start") startTimeStamp: string, @Query("end") endTimeStamp: string) {
    let details = await this.nodeHealthService.getLost(group, startTimeStamp, endTimeStamp);
    const groupedData = details.reduce((acc, item) => {
      const endpoint = item.endpoint_url;
      if (!acc[endpoint]) {
        acc[endpoint] = [];
      }
      acc[endpoint].push(item);
      return acc;
    }, {});
    return await this.apiService.findAllLostMinute(groupedData); // 요청 못한 시간 추출하기.
  }

  @Get(`/status/lost/detail`)
  async getLostDetail(@Query("group") group: string, @Query("start") startTimeStamp: string, @Query("end") endTimeStamp: string) {
    let details = await this.nodeHealthService.getLostDetail(group, startTimeStamp, endTimeStamp);
    const groupedData = details.reduce((acc, item) => {
      const endpoint = item.endpoint_url;
      if (!acc[endpoint]) {
        acc[endpoint] = [];
      }
      acc[endpoint].push(item);
      return acc;
    }, {});
    return await this.apiService.groupingLostRequestDetail(groupedData);
  }

  @Get('/distinct-endpoints')
  async getDistinctEndpoints() {
    let endpoints = await this.nodeHealthService.getDistinctEndpoints();
    let distinguishEndpoints = {};
    const odinURL = endpoints.filter(url => !url.includes('heimdall'));
    const heimdallURL = endpoints.filter(url => url.includes('heimdall'));
    distinguishEndpoints['odin'] = odinURL;
    distinguishEndpoints['heimdall'] = heimdallURL;
    return distinguishEndpoints;
  }
}
