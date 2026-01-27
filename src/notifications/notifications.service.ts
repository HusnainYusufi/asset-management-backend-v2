import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

export interface CreateNotificationDto {
  title: string;
  message: string;
  type: NotificationType;
  tenantId: string;
  clientId: Types.ObjectId;
  userId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  showroomAssetId?: Types.ObjectId;
  assetName?: string;
  showroomName?: string;
  daysUntilExpiry?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationDocument> {
    const notification = new this.notificationModel(dto);
    return notification.save();
  }

  async findAllForUser(
    tenantId: string,
    userId?: string,
  ): Promise<NotificationDocument[]> {
    const query: Record<string, unknown> = { tenantId };

    if (userId) {
      query.$or = [
        { userId: new Types.ObjectId(userId) },
        { userId: { $exists: false } },
        { userId: null },
      ];
    }

    return this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async markAsRead(id: string): Promise<NotificationDocument | null> {
    return this.notificationModel
      .findByIdAndUpdate(id, { isRead: true }, { new: true })
      .exec();
  }

  async markAllAsRead(tenantId: string, userId?: string): Promise<void> {
    const query: Record<string, unknown> = { tenantId, isRead: false };

    if (userId) {
      query.$or = [
        { userId: new Types.ObjectId(userId) },
        { userId: { $exists: false } },
        { userId: null },
      ];
    }

    await this.notificationModel.updateMany(query, { isRead: true }).exec();
  }

  async getUnreadCount(tenantId: string, userId?: string): Promise<number> {
    const query: Record<string, unknown> = { tenantId, isRead: false };

    if (userId) {
      query.$or = [
        { userId: new Types.ObjectId(userId) },
        { userId: { $exists: false } },
        { userId: null },
      ];
    }

    return this.notificationModel.countDocuments(query).exec();
  }

  async deleteOldNotifications(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.notificationModel
      .deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true,
      })
      .exec();
  }
}
