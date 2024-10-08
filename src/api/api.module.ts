import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { NodeHealthModule } from "./db/node-health/node-health.module";
import { NodeHealth } from "./db/node-health/node-health";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from 'path';
import {NodeHealthService} from "./db/node-health/node-health.service";
import {NodeHealthRepository} from "./db/node-health/node-health.repository";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: false,
      envFilePath: '.development.env',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'rootroot',
      database: 'nodehealth',
      entities: [NodeHealth],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    HttpModule,
    NodeHealthModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../..','public'), // Serve from the 'public' directory
    }),
  ],
  controllers: [ApiController],
  providers: [ApiService],
  exports: [ApiService]
})
export class ApiModule {}
