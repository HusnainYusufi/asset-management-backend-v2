import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationType {
  EXPIRATION_REMINDER = 'EXPIRATION_REMINDER',
  EXPIRATION_TODAY = 'EXPIRATION_TODAY',
}

@Schema({ timestamps: true })
export class Notification {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true, type: Types.ObjectId })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  assetId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  showroomAssetId?: Types.ObjectId;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  assetName?: string;

  @Prop()
  showroomName?: string;

  @Prop()
  daysUntilExpiry?: number;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
