import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateTrackedAppDto {
  @IsString()
  name!: string;

  @IsUrl()
  playStoreUrl!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  intervalMinutes?: number;
}
