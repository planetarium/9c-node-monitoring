import { Controller, Get, Query } from "@nestjs/common";
import { ApiService } from "./api.service";
import { ConfigService } from "@nestjs/config";


@Controller('/api')
export class ApiController {
  constructor(private readonly apiService: ApiService,
              private readonly configService: ConfigService) {}


}
