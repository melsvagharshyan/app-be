import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTrackedAppDto } from '../dto/create-tracked-app.dto';
import { UpdateTrackedAppDto } from '../dto/update-tracked-app.dto';
import { TrackedApp, TrackedAppDocument } from '../schemas/tracked-app.schema';
import { ScreenshotsService } from './screenshots.service';

@Injectable()
export class TrackedAppsService {
  constructor(
    @InjectModel(TrackedApp.name)
    private readonly trackedAppModel: Model<TrackedAppDocument>,
    private readonly screenshotsService: ScreenshotsService,
  ) {}

  async create(dto: CreateTrackedAppDto): Promise<TrackedAppDocument> {
    return this.trackedAppModel.create({
      name: dto.name,
      playStoreUrl: dto.playStoreUrl,
      isActive: dto.isActive ?? true,
      intervalMinutes: dto.intervalMinutes ?? 30,
    });
  }

  async findAll(): Promise<TrackedAppDocument[]> {
    return this.trackedAppModel
      .find()
      .sort({ createdAt: -1 })
      .lean(false)
      .exec();
  }

  async update(
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

  async deleteById(id: string): Promise<void> {
    const app = await this.trackedAppModel.findByIdAndDelete(id).exec();

    if (!app) {
      throw new NotFoundException('Tracked app not found');
    }

    await this.screenshotsService.deleteAllForApp(app._id);
  }

  async findById(id: string): Promise<TrackedAppDocument | null> {
    return this.trackedAppModel.findById(id).exec();
  }

  async findAllActive(): Promise<TrackedAppDocument[]> {
    return this.trackedAppModel.find({ isActive: true }).exec();
  }
}
