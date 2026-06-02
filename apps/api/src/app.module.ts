import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { TenantMiddleware } from './common/tenancy/tenant.middleware';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { PimModule } from './modules/pim/pim.module';
import { EsmModule } from './modules/esm/esm.module';
import { PayModule } from './modules/pay/pay.module';
import { LveModule } from './modules/lve/lve.module';
import { EssModule } from './modules/ess/ess.module';
import { PomModule } from './modules/pom/pom.module';
import { PemModule } from './modules/pem/pem.module';
import { TrmModule } from './modules/trm/trm.module';
import { HamModule } from './modules/ham/ham.module';
import { CdmModule } from './modules/cdm/cdm.module';
import { ExmModule } from './modules/exm/exm.module';
import { HbmModule } from './modules/hbm/hbm.module';
import { RecModule } from './modules/rec/rec.module';
import { BilModule } from './modules/bil/bil.module';
import { SuspendMiddleware } from './common/billing/suspend.middleware';

@Module({
  imports: [
    CommonModule,
    PimModule,
    EsmModule,
    PayModule,
    LveModule,
    EssModule,
    PomModule,
    PemModule,
    TrmModule,
    HamModule,
    CdmModule,
    ExmModule,
    HbmModule,
    RecModule,
    BilModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every request resolves a tenant first (SaaS sub-domain / on-prem pin),
    // then the suspend gate (402 on non-paying tenants, allow-listed routes).
    consumer.apply(TenantMiddleware).forRoutes('*');
    consumer.apply(SuspendMiddleware).forRoutes('*');
  }
}
