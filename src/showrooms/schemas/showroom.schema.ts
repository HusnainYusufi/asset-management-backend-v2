import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum ShowroomAssetType {
  GENERAL = 'GENERAL',
  CREDENTIALS = 'CREDENTIALS',
  FILES = 'FILES',
  LINKS = 'LINKS',
}

export enum ShowroomAssetFieldType {
  TEXT = 'TEXT',
  PASSWORD = 'PASSWORD',
  EMAIL = 'EMAIL',
  USERNAME = 'USERNAME',
  URL = 'URL',
  NOTE = 'NOTE',
  NUMBER = 'NUMBER',
}

@Schema({ _id: true })
export class ShowroomMetaField {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, trim: true })
  value: string;
}

export const ShowroomMetaFieldSchema =
  SchemaFactory.createForClass(ShowroomMetaField);

@Schema({ _id: true })
export class ShowroomTemplateSize {
  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;

  @Prop({ required: true, trim: true, default: 'px' })
  unit: string;
}

export const ShowroomTemplateSizeSchema =
  SchemaFactory.createForClass(ShowroomTemplateSize);

@Schema({ _id: true })
export class ShowroomTemplate {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [ShowroomTemplateSizeSchema], default: [] })
  sizes: ShowroomTemplateSize[];

  @Prop({ type: [ShowroomMetaFieldSchema], default: [] })
  metaFields: ShowroomMetaField[];
}

export const ShowroomTemplateSchema =
  SchemaFactory.createForClass(ShowroomTemplate);

@Schema({ timestamps: true })
export class Showroom {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true, type: Types.ObjectId })
  clientId: Types.ObjectId;

  @Prop({ type: [ShowroomMetaFieldSchema], default: [] })
  metaFields: ShowroomMetaField[];

  @Prop({ type: [ShowroomTemplateSchema], default: [] })
  templates: Types.DocumentArray<ShowroomTemplate>;
}

export type ShowroomDocument = HydratedDocument<Showroom>;
export const ShowroomSchema = SchemaFactory.createForClass(Showroom);

@Schema({ _id: true })
export class ShowroomAssetField {
  @Prop({ required: true, trim: true })
  key: string;

  @Prop({ required: true, enum: ShowroomAssetFieldType })
  type: ShowroomAssetFieldType;

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

export const ShowroomAssetFieldSchema =
  SchemaFactory.createForClass(ShowroomAssetField);

@Schema({ _id: true })
export class ShowroomAssetFile {
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

export const ShowroomAssetFileSchema =
  SchemaFactory.createForClass(ShowroomAssetFile);

@Schema({ timestamps: true })
export class ShowroomAsset {
  _id?: Types.ObjectId;
  id?: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, enum: ShowroomAssetType })
  type: ShowroomAssetType;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true, type: Types.ObjectId })
  clientId: Types.ObjectId;

  @Prop({ required: true, index: true, type: Types.ObjectId })
  showroomId: Types.ObjectId;

  @Prop({ type: [ShowroomAssetFieldSchema], default: [] })
  fields: ShowroomAssetField[];

  @Prop({ type: [ShowroomAssetFileSchema], default: [] })
  files: Types.DocumentArray<ShowroomAssetFile>;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Date })
  expirationDate?: Date;

  @Prop({ default: false })
  expirationNotificationsEnabled?: boolean;

  @Prop({ type: [Date], default: [] })
  notificationsSentAt?: Date[];
}

export type ShowroomAssetDocument = HydratedDocument<ShowroomAsset>;
export const ShowroomAssetSchema = SchemaFactory.createForClass(ShowroomAsset);
