import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum AssetType {
  GENERAL = 'GENERAL',
  CREDENTIALS = 'CREDENTIALS',
  FILES = 'FILES',
  LINKS = 'LINKS',
}

export enum AssetFieldType {
  TEXT = 'TEXT',
  PASSWORD = 'PASSWORD',
  EMAIL = 'EMAIL',
  USERNAME = 'USERNAME',
  URL = 'URL',
  NOTE = 'NOTE',
  NUMBER = 'NUMBER',
}

@Schema({ _id: true })
export class AssetField {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, enum: AssetFieldType, default: AssetFieldType.TEXT })
  type: AssetFieldType;

  @Prop({ default: false })
  isSecret: boolean;

  @Prop()
  value?: string;

  @Prop()
  encryptedValue?: string;

  @Prop()
  iv?: string;

  @Prop()
  tag?: string;
}

export const AssetFieldSchema = SchemaFactory.createForClass(AssetField);

@Schema({ _id: true })
export class AssetFile {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  relativePath: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  uploadedBy: string;

  @Prop({ default: Date.now })
  uploadedAt: Date;
}

export const AssetFileSchema = SchemaFactory.createForClass(AssetFile);

@Schema({ timestamps: true })
export class Asset {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true, default: AssetType.GENERAL })
  type?: string;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true, type: Types.ObjectId })
  clientId: Types.ObjectId;

  @Prop({ type: [AssetFieldSchema], default: [] })
  fields: AssetField[];

  @Prop({ type: [AssetFileSchema], default: [] })
  files: Types.DocumentArray<AssetFile>;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Date })
  expirationDate?: Date;

  @Prop({ default: false })
  expirationNotificationsEnabled?: boolean;

  @Prop({ type: [Date], default: [] })
  notificationsSentAt?: Date[];
}

export type AssetDocument = HydratedDocument<Asset>;
export const AssetSchema = SchemaFactory.createForClass(Asset);
