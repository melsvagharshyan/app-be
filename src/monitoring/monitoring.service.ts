import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import puppeteer, { Browser } from 'puppeteer';
import { handleDeleteImage, handleUpload } from '../cloud/cloudinary';
import { CreateTrackedAppDto } from './dto/create-tracked-app.dto';
import { UpdateTrackedAppDto } from './dto/update-tracked-app.dto';
import { Screenshot, ScreenshotDocument } from './schemas/screenshot.schema';
import { TrackedApp, TrackedAppDocument } from './schemas/tracked-app.schema';
import 'dotenv/config';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private browser: Browser | null = null;
  private isCapturingBatch = false;

  constructor(
    @InjectModel(TrackedApp.name)
    private readonly trackedAppModel: Model<TrackedAppDocument>,
    @InjectModel(Screenshot.name)
    private readonly screenshotModel: Model<ScreenshotDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const intervalMinutes = Number(process.env.MONITOR_INTERVAL_MINUTES ?? 30);
    this.intervalId = setInterval(
      () => void this.captureAllActiveApps(),
      Math.max(intervalMinutes, 1) * 60 * 1000,
    );
    void this.captureAllActiveApps();
  }

  async createTrackedApp(
    dto: CreateTrackedAppDto,
  ): Promise<TrackedAppDocument> {
    return this.trackedAppModel.create({
      name: dto.name,
      playStoreUrl: dto.playStoreUrl,
      isActive: dto.isActive ?? true,
      intervalMinutes: dto.intervalMinutes ?? 30,
    });
  }

  async getTrackedApps(): Promise<TrackedAppDocument[]> {
    return this.trackedAppModel
      .find()
      .sort({ createdAt: -1 })
      .lean(false)
      .exec();
  }

  async updateTrackedApp(
    id: string,
    dto: UpdateTrackedAppDto,
  ): Promise<TrackedAppDocument> {
    const updated = await this.trackedAppModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .lean(false)
      .exec();

    if (!updated) {
      throw new NotFoundException('Tracked app not found');
    }

    return updated;
  }

  async deleteTrackedApp(id: string): Promise<void> {
    const app = await this.trackedAppModel.findByIdAndDelete(id).exec();

    if (!app) {
      throw new NotFoundException('Tracked app not found');
    }

    const screenshots = await this.screenshotModel
      .find({ appId: app._id })
      .exec();
    await Promise.all(
      screenshots.map(async (screenshot) => {
        await handleDeleteImage(screenshot.cloudinaryPublicId);
      }),
    );
    await this.screenshotModel.deleteMany({ appId: app._id }).exec();
  }

  async getAppScreenshots(id: string): Promise<ScreenshotDocument[]> {
    return this.screenshotModel
      .find({ appId: new Types.ObjectId(id) })
      .sort({ capturedAt: -1 })
      .exec();
  }

  async captureNow(id: string): Promise<ScreenshotDocument> {
    const app = await this.trackedAppModel.findById(id).exec();

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
      const activeApps = await this.trackedAppModel
        .find({ isActive: true })
        .exec();
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

  private async captureAppScreenshot(
    app: TrackedAppDocument,
  ): Promise<ScreenshotDocument> {
    try {
      return await this.captureAppScreenshotInternal(app);
    } catch (error) {
      const message = (error as Error).message ?? '';
      const shouldRetry =
        message.includes('Connection closed') ||
        message.includes('Target closed') ||
        message.includes('Session closed');

      if (!shouldRetry) {
        throw error;
      }

      this.logger.warn(
        `Browser connection dropped for app ${app._id.toString()}. Restarting browser and retrying once.`,
      );
      await this.disposeBrowser();
      return this.captureAppScreenshotInternal(app);
    }
  }

  private async shouldCaptureApp(app: TrackedAppDocument): Promise<boolean> {
    const latest = await this.screenshotModel
      .findOne({ appId: app._id })
      .sort({ capturedAt: -1 })
      .select({ capturedAt: 1 })
      .lean()
      .exec();

    if (!latest?.capturedAt) {
      return true;
    }

    const elapsedMs = Date.now() - new Date(latest.capturedAt).getTime();
    return elapsedMs >= app.intervalMinutes * 60 * 1000;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) {
      return this.browser;
    }

    if (this.browser && !this.browser.connected) {
      await this.disposeBrowser();
    }

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ];

    const executableCandidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/opt/google/chrome/chrome',
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const executablePath of executableCandidates) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          executablePath,
          args: launchArgs,
        });
        this.browser.on('disconnected', () => {
          this.logger.warn('Puppeteer browser disconnected.');
          this.browser = null;
        });
        this.logger.log(
          `Puppeteer launched using executable path: ${executablePath}`,
        );
        return this.browser;
      } catch (pathError) {
        this.logger.warn(
          `Failed to launch browser from ${executablePath}. ${(pathError as Error).message}`,
        );
      }
    }

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        channel: 'chrome',
        args: launchArgs,
      });
      this.browser.on('disconnected', () => {
        this.logger.warn('Puppeteer browser disconnected.');
        this.browser = null;
      });
      this.logger.log('Puppeteer launched using system Chrome channel.');
      return this.browser;
    } catch (channelError) {
      this.logger.warn(
        `Failed to launch system Chrome channel. Falling back to Puppeteer-managed browser. ${(channelError as Error).message}`,
      );
    }

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: launchArgs,
      });
      this.browser.on('disconnected', () => {
        this.logger.warn('Puppeteer browser disconnected.');
        this.browser = null;
      });
      this.logger.log('Puppeteer launched using Puppeteer-managed browser.');
      return this.browser;
    } catch (defaultError) {
      throw new Error(
        `Browser launch failed. Install Chromium/Chrome in the container or set PUPPETEER_EXECUTABLE_PATH. Original error: ${(defaultError as Error).message}`,
      );
    }
  }

  private async captureAppScreenshotInternal(
    app: TrackedAppDocument,
  ): Promise<ScreenshotDocument> {
    const page = await (await this.getBrowser()).newPage();
    try {
      await page.setViewport({ width: 1440, height: 2000 });
      await page.goto(app.playStoreUrl, {
        waitUntil: 'networkidle2',
        timeout: 90_000,
      });
      await page.waitForSelector('body', { timeout: 15_000 });

      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const base64Image = Buffer.from(screenshot).toString('base64');
      const upload = await handleUpload(`data:image/png;base64,${base64Image}`);

      return this.screenshotModel.create({
        appId: app._id,
        imageUrl: upload.secure_url,
        cloudinaryPublicId: upload.public_id,
        capturedAt: new Date(),
      });
    } finally {
      await page.close();
    }
  }

  private async disposeBrowser(): Promise<void> {
    if (!this.browser) {
      return;
    }

    try {
      await this.browser.close();
    } catch {
      // Ignore close errors; we are resetting stale browser state.
    } finally {
      this.browser = null;
    }
  }
}
