import { Controller, Get, Query } from "@nestjs/common";
import { ApiService } from "./api.service";
import { ConfigService } from "@nestjs/config";


@Controller('/api')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('/endpoint')
  async getRpcEndPoints() {
    return await this.apiService.getRPCEndPoints();
  }

  @Get('/test')
  async test() {
    return await this.apiService.test();
  }
}
