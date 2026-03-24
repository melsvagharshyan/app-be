import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonitoringModule } from './monitoring/monitoring.module';
import 'dotenv/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const directUri = configService.get<string>('MONGODB_URI');
        if (directUri) {
          return { uri: directUri };
        }

        const user = encodeURIComponent(
          configService.get<string>('MONGODB_USER', ''),
        );
        const pass = encodeURIComponent(
          configService.get<string>('MONGODB_PASS', ''),
        );
        const host = configService.get<string>(
          'MONGODB_HOST',
          'cluster0.jedxf.mongodb.net',
        );
        const dbName = configService.get<string>('MONGODB_DB', 'app');

        return {
          uri: `mongodb+srv://${user}:${pass}@${host}/${dbName}?retryWrites=true&w=majority`,
        };
      },
    }),
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
