import 'reflect-metadata';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

@Catch()
class AllExceptionsFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');
  catch(exception: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest();
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `${req?.method} ${req?.originalUrl ?? req?.url} — ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }
    super.catch(exception, host);
  }
}

async function bootstrap() {
  // rawBody so Stripe webhook handler can verify the signature on bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter(app.getHttpAdapter()));
  // Input validation is done in-controller via Zod (`Schema.parse(...)`), so
  // no global ValidationPipe (which would require class-validator).
  await app.listen(process.env.PORT ?? 4000);
  // eslint-disable-next-line no-console
  console.log(`HRMS API on :${process.env.PORT ?? 4000}`);
}
bootstrap();
