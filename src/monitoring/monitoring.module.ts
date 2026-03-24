import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { Screenshot, ScreenshotSchema } from './schemas/screenshot.schema';
import { TrackedApp, TrackedAppSchema } from './schemas/tracked-app.schema';
import { PlayStoreBrowserService } from './services/play-store-browser.service';
import { PlayStoreCaptureService } from './services/play-store-capture.service';
import { ScreenshotsService } from './services/screenshots.service';
import { TrackedAppsService } from './services/tracked-apps.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackedApp.name, schema: TrackedAppSchema },
      { name: Screenshot.name, schema: ScreenshotSchema },
    ]),
  ],
  controllers: [MonitoringController],
  providers: [
    PlayStoreBrowserService,
    PlayStoreCaptureService,
    ScreenshotsService,
    TrackedAppsService,
    MonitoringService,
  ],
})
export class MonitoringModule {}
