import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RegistryPrismaService } from './prisma/registry-prisma.service';
import { TenantPrismaService } from './prisma/tenant-prisma.service';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { AuthService } from './auth/auth.service';
import { OidcService } from './auth/oidc.service';
import { AuthController } from './auth/auth.controller';
import { JwtGuard } from './auth/jwt.guard';
import { PermissionsGuard } from './rbac/permissions.guard';
import { ConfigController } from './config/config.controller';

/** Platform core: tenancy, identity, RBAC, audit, config. Globally available. */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController, ConfigController, AuditController],
  providers: [
    RegistryPrismaService,
    TenantPrismaService,
    AuditService,
    AuthService,
    OidcService,
    JwtGuard,
    PermissionsGuard,
  ],
  exports: [
    JwtModule,
    RegistryPrismaService,
    TenantPrismaService,
    AuditService,
    JwtGuard,
    PermissionsGuard,
  ],
})
export class CommonModule {}
