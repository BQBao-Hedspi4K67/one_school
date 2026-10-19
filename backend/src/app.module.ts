import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EventsModule } from './events/events.module';
import { UploadsModule } from './uploads/uploads.module';
import { SurveysModule } from './surveys/surveys.module';
import { ArticlesModule } from './articles/articles.module';
import { CyclesModule } from './cycles/cycles.module';
import { ConnectModule } from './connect/connect.module';
import { GuestModule } from './guest/guest.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AnalyticsModule,
    EventsModule,
    UploadsModule,
    SurveysModule,
    ArticlesModule,
    CyclesModule,
    ConnectModule,
    GuestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
