import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OWNER = 'OWNER',
  TEAM_MEMBER = 'TEAM_MEMBER',
  CLIENT_USER = 'CLIENT_USER',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, lowercase: true, trim: true, unique: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  passwordHash?: string;

  @Prop({ required: true, enum: UserRole })
  role: UserRole;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ type: Types.ObjectId, ref: 'Client' })
  clientId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  invitationTokenHash?: string;

  @Prop()
  invitationExpiresAt?: Date;

  @Prop()
  resetPasswordTokenHash?: string;

  @Prop()
  resetPasswordExpiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
