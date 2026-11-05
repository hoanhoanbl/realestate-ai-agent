import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesModule } from './properties/properties.module';
import { LeadsModule } from './leads/leads.module';
import { ViewingsModule } from './viewings/viewings.module';
import { StatsModule } from './stats/stats.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { N8nModule } from './n8n/n8n.module';
import { FeedbackModule } from './feedback/feedback.module';
import { ContractsModule } from './contracts/contracts.module';
import { ReportsModule } from './reports/reports.module';
import { FollowupsModule } from './followups/followups.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),

    PropertiesModule,

    LeadsModule,

    ViewingsModule,

    StatsModule,

    UsersModule,

    AuthModule,

    N8nModule,

    FeedbackModule,

    ContractsModule,

    ReportsModule,
    FollowupsModule,
  ],
})
export class AppModule {}
