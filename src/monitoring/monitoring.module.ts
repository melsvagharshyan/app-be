import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { Screenshot, ScreenshotSchema } from './schemas/screenshot.schema';
import { TrackedApp, TrackedAppSchema } from './schemas/tracked-app.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackedApp.name, schema: TrackedAppSchema },
      { name: Screenshot.name, schema: ScreenshotSchema },
    ]),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
})
export class MonitoringModule {}
