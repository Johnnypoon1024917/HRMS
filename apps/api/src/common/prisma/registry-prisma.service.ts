import { Injectable, OnModuleInit } from '@nestjs/common';
// Generated from prisma/registry.prisma into a dedicated output path so the
// global registry client never collides with the per-tenant client.
import { PrismaClient } from '../../../node_modules/.prisma/registry';

@Injectable()
export class RegistryPrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
