import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Mutex } from "async-mutex";
import { ApiService } from "../api.service";
import { HttpService } from "@nestjs/axios";


@Injectable()
export class BridgeService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService,
              private readonly apiService: ApiService,
              private readonly httpService: HttpService,
  ) {}

  private readonly logger = new Logger(BridgeService.name);
  private interval: NodeJS.Timeout;

  onModuleInit() {
    this.startInterval();
  }

  onModuleDestroy() {
    this.stopInterval();
  }

  startInterval() {
    this.interval = setInterval(() => {
      this.handleCron();
    }, 10000); // 5000 밀리초 = 5초

    setTimeout(() => {
      this.stopInterval();
      this.startInterval();
    }, 10000); // 10초 후 인터벌 종료
  }

  stopInterval() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  handleCron() {
    // this.logger.debug('burn 모니터링 시작');
  }

}