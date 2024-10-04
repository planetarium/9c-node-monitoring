import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { TasksService } from "./scheduler/tasks.service";
import { SepoliaModule } from "./transaction/sepolia/sepolia.module";
import { Sepolia } from "./transaction/sepolia/sepolia";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from 'path';
import { BridgeService } from "./scheduler/bridge.service";

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
      database: 'mint',
      entities: [Sepolia],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    HttpModule,
    SepoliaModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../..','public'), // Serve from the 'public' directory
    }),
  ],
  controllers: [ApiController],
  providers: [ApiService, TasksService, BridgeService],
  exports: [ApiService]
})
export class ApiModule {}
