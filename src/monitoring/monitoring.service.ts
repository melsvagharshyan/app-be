import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ScreenshotDocument } from './schemas/screenshot.schema';
import { TrackedAppDocument } from './schemas/tracked-app.schema';
import { PlayStoreCaptureService } from './services/play-store-capture.service';
import { ScreenshotsService } from './services/screenshots.service';
import { TrackedAppsService } from './services/tracked-apps.service';
import { CreateTrackedAppDto } from './dto/create-tracked-app.dto';
import { UpdateTrackedAppDto } from './dto/update-tracked-app.dto';
import 'dotenv/config';

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isCapturingBatch = false;

  constructor(
    private readonly trackedApps: TrackedAppsService,
    private readonly screenshots: ScreenshotsService,
    private readonly playStoreCapture: PlayStoreCaptureService,
  ) {}

  async onModuleInit(): Promise<void> {
    const intervalMinutes = Number(process.env.MONITOR_INTERVAL_MINUTES ?? 30);
    this.intervalId = setInterval(
      () => void this.captureAllActiveApps(),
      Math.max(intervalMinutes, 1) * 60 * 1000,
    );
    void this.captureAllActiveApps();
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  createTrackedApp(dto: CreateTrackedAppDto): Promise<TrackedAppDocument> {
    return this.trackedApps.create(dto);
  }

  getTrackedApps(): Promise<TrackedAppDocument[]> {
    return this.trackedApps.findAll();
  }

  updateTrackedApp(
    id: string,
    dto: UpdateTrackedAppDto,
  ): Promise<TrackedAppDocument> {
    return this.trackedApps.update(id, dto);
  }

  async deleteTrackedApp(id: string): Promise<void> {
    await this.trackedApps.deleteById(id);
  }

  getAppScreenshots(id: string): Promise<ScreenshotDocument[]> {
    return this.screenshots.listByAppId(id);
  }

  async captureNow(id: string): Promise<ScreenshotDocument> {
    const app = await this.trackedApps.findById(id);

    if (!app) {
      throw new NotFoundException('Tracked app not found');
    }

    return this.captureAppScreenshot(app);
  }

  private async captureAllActiveApps(): Promise<void> {
    if (this.isCapturingBatch) {
      return;
    }

    this.isCapturingBatch = true;
    try {
      const activeApps = await this.trackedApps.findAllActive();
      for (const app of activeApps) {
        try {
          const shouldCapture = await this.shouldCaptureApp(app);
          if (!shouldCapture) {
            continue;
          }
          await this.captureAppScreenshot(app);
        } catch (error) {
          this.logger.error(
            `Failed capture for ${app.name} (${app._id.toString()}): ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.isCapturingBatch = false;
    }
  }

  private async shouldCaptureApp(app: TrackedAppDocument): Promise<boolean> {
    const latestAt = await this.screenshots.getLatestCapturedAt(app._id);
    if (!latestAt) {
      return true;
    }

    const elapsedMs = Date.now() - latestAt.getTime();
    return elapsedMs >= app.intervalMinutes * 60 * 1000;
  }

  private async captureAppScreenshot(
    app: TrackedAppDocument,
  ): Promise<ScreenshotDocument> {
    const upload = await this.playStoreCapture.captureListingToCloudinary(
      app.playStoreUrl,
    );

    return this.screenshots.createForApp(
      app._id,
      upload.secure_url,
      upload.public_id,
      new Date(),
    );
  }
}
