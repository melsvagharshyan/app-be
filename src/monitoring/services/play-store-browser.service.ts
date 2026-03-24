import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

const DEFAULT_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
] as const;

@Injectable()
export class PlayStoreBrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(PlayStoreBrowserService.name);
  private browser: Browser | null = null;

  async onModuleDestroy(): Promise<void> {
    await this.dispose();
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) {
      return this.browser;
    }

    if (this.browser && !this.browser.connected) {
      await this.dispose();
    }

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
          args: [...DEFAULT_LAUNCH_ARGS],
        });
        this.attachDisconnectHandler();
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
        args: [...DEFAULT_LAUNCH_ARGS],
      });
      this.attachDisconnectHandler();
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
        args: [...DEFAULT_LAUNCH_ARGS],
      });
      this.attachDisconnectHandler();
      this.logger.log('Puppeteer launched using Puppeteer-managed browser.');
      return this.browser;
    } catch (defaultError) {
      throw new Error(
        `Browser launch failed. Install Chromium/Chrome in the container or set PUPPETEER_EXECUTABLE_PATH. Original error: ${(defaultError as Error).message}`,
      );
    }
  }

  async dispose(): Promise<void> {
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

  private attachDisconnectHandler(): void {
    if (!this.browser) {
      return;
    }
    this.browser.on('disconnected', () => {
      this.logger.warn('Puppeteer browser disconnected.');
      this.browser = null;
    });
  }
}
