import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://3.35.227.125:3000'], // 웹 서버 주소만 허용
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });
  await app.listen(4000);
}
bootstrap();
