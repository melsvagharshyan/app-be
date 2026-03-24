import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { handleDeleteImage } from '../../cloud/cloudinary';
import { Screenshot, ScreenshotDocument } from '../schemas/screenshot.schema';

@Injectable()
export class ScreenshotsService {
  constructor(
    @InjectModel(Screenshot.name)
    private readonly screenshotModel: Model<ScreenshotDocument>,
  ) {}

  async createForApp(
    appId: Types.ObjectId,
    imageUrl: string,
    cloudinaryPublicId: string,
    capturedAt: Date,
  ): Promise<ScreenshotDocument> {
    return this.screenshotModel.create({
      appId,
      imageUrl,
      cloudinaryPublicId,
      capturedAt,
    });
  }

  async listByAppId(appId: string): Promise<ScreenshotDocument[]> {
    return this.screenshotModel
      .find({ appId: new Types.ObjectId(appId) })
      .sort({ capturedAt: -1 })
      .exec();
  }

  async getLatestCapturedAt(appId: Types.ObjectId): Promise<Date | null> {
    const latest = await this.screenshotModel
      .findOne({ appId })
      .sort({ capturedAt: -1 })
      .select({ capturedAt: 1 })
      .lean()
      .exec();

    return latest?.capturedAt ? new Date(latest.capturedAt) : null;
  }

  async deleteAllForApp(appId: Types.ObjectId): Promise<void> {
    const screenshots = await this.screenshotModel.find({ appId }).exec();
    await Promise.all(
      screenshots.map((screenshot) =>
        handleDeleteImage(screenshot.cloudinaryPublicId),
      ),
    );
    await this.screenshotModel.deleteMany({ appId }).exec();
  }
}
