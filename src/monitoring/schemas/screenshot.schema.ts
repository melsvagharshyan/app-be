import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScreenshotDocument = HydratedDocument<Screenshot>;

@Schema({ timestamps: true })
export class Screenshot {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'TrackedApp', index: true })
  appId!: Types.ObjectId;

  @Prop({ required: true })
  imageUrl!: string;

  @Prop({ required: true })
  cloudinaryPublicId!: string;

  @Prop({ default: Date.now, index: true })
  capturedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ScreenshotSchema = SchemaFactory.createForClass(Screenshot);
