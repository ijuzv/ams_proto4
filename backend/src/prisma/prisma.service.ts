import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type BeforeExitListener = () => Promise<void>;

declare module '@prisma/client' {
  interface PrismaClient {
    $on(event: 'beforeExit', callback: BeforeExitListener): void;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    (this as any).$on('beforeExit', async () => {
      await app.close();
    });
  }
}
