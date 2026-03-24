import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateTrackedAppDto } from './dto/create-tracked-app.dto';
import { UpdateTrackedAppDto } from './dto/update-tracked-app.dto';
import { MonitoringService } from './monitoring.service';

@Controller('apps')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  async getApps() {
    return this.monitoringService.getTrackedApps();
  }

  @Post()
  async createApp(@Body() dto: CreateTrackedAppDto) {
    return this.monitoringService.createTrackedApp(dto);
  }

  @Patch(':id')
  async updateApp(@Param('id') id: string, @Body() dto: UpdateTrackedAppDto) {
    return this.monitoringService.updateTrackedApp(id, dto);
  }

  @Delete(':id')
  async deleteApp(@Param('id') id: string) {
    await this.monitoringService.deleteTrackedApp(id);
    return { ok: true };
  }

  @Post(':id/capture')
  async captureApp(@Param('id') id: string) {
    return this.monitoringService.captureNow(id);
  }

  @Get(':id/screenshots')
  async getScreenshots(@Param('id') id: string) {
    return this.monitoringService.getAppScreenshots(id);
  }
}
