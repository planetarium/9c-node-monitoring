import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Transaction } from './transaction/transaction.entity';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: false,
      envFilePath: '../../.development.env',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'ninechronicles-monitoring.clt1rqxjlnwh.ap-northeast-2.rds.amazonaws.com',
      port: 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'ninechronicles_node_status',
      entities: [Transaction],
      synchronize: true,
      logging: ['error', 'warn'], // 쿼리, 에러, 경고 로그만 출력
      //TODO : 필요없어지면 로깅 끄기
    }),
    TransactionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    // 환경 변수 값 출력
    console.log('DB_USERNAME:', process.env.DB_USERNAME);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
  }
}

