import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../database/prisma.module';
import { ConnectController } from './connect.controller';
import { ConnectService } from './connect.service';
import { ConnectAiService } from './connect-ai.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ConnectController],
  providers: [
    ConnectService,
    ConnectAiService,
    { provide: 'CONNECT_AI_CONFIG', useExisting: ConfigService },
  ],
})
export class ConnectModule {}
