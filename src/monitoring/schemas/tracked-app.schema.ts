import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TrackedAppDocument = HydratedDocument<TrackedApp>;

@Schema({ timestamps: true })
export class TrackedApp {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true })
  playStoreUrl!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 30, min: 1 })
  intervalMinutes!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const TrackedAppSchema = SchemaFactory.createForClass(TrackedApp);
