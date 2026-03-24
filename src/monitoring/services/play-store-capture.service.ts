import { Injectable, Logger } from '@nestjs/common';
import type { CloudinaryUploadResult } from '../../cloud/cloudinary';
import { handleUpload } from '../../cloud/cloudinary';
import { PlayStoreBrowserService } from './play-store-browser.service';

const VIEWPORT = { width: 1440, height: 2000 } as const;
const GOTO_TIMEOUT_MS = 90_000;
const BODY_SELECTOR_TIMEOUT_MS = 15_000;

function isTransientBrowserError(message: string): boolean {
  return (
    message.includes('Connection closed') ||
    message.includes('Target closed') ||
    message.includes('Session closed')
  );
}

@Injectable()
export class PlayStoreCaptureService {
  private readonly logger = new Logger(PlayStoreCaptureService.name);

  constructor(private readonly browserService: PlayStoreBrowserService) {}

  async captureListingToCloudinary(
    playStoreUrl: string,
  ): Promise<CloudinaryUploadResult> {
    try {
      return await this.captureOnce(playStoreUrl);
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!isTransientBrowserError(message)) {
        throw error;
      }

      this.logger.warn(
        'Browser connection dropped during capture. Restarting browser and retrying once.',
      );
      await this.browserService.dispose();
      return this.captureOnce(playStoreUrl);
    }
  }

  private async captureOnce(
    playStoreUrl: string,
  ): Promise<CloudinaryUploadResult> {
    const browser = await this.browserService.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport(VIEWPORT);
      await page.goto(playStoreUrl, {
        waitUntil: 'networkidle2',
        timeout: GOTO_TIMEOUT_MS,
      });
      await page.waitForSelector('body', { timeout: BODY_SELECTOR_TIMEOUT_MS });

      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const base64Image = Buffer.from(screenshot).toString('base64');
      return handleUpload(`data:image/png;base64,${base64Image}`);
    } finally {
      await page.close();
    }
  }
}
