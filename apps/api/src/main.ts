import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*', //TODO: 배포 완료 후 cors 변경
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  await app.listen(4000);
}
bootstrap();
