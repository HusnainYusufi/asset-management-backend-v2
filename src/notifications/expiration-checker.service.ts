import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Asset, AssetDocument } from '../assets/schemas/asset.schema';
import {
  ShowroomAsset,
  ShowroomAssetDocument,
  Showroom,
  ShowroomDocument,
} from '../showrooms/schemas/showroom.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../common/mail/mail.service';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './schemas/notification.schema';

@Injectable()
export class ExpirationCheckerService {
  private readonly logger = new Logger(ExpirationCheckerService.name);
  private readonly REMINDER_DAYS = [5, 3, 2, 0];

  constructor(
    @InjectModel(Asset.name)
    private readonly assetModel: Model<AssetDocument>,
    @InjectModel(ShowroomAsset.name)
    private readonly showroomAssetModel: Model<ShowroomAssetDocument>,
    @InjectModel(Showroom.name)
    private readonly showroomModel: Model<ShowroomDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringAssets(): Promise<void> {
    this.logger.log('Starting expiration check...');

    for (const days of this.REMINDER_DAYS) {
      await this.processExpiringAssets(days);
      await this.processExpiringShowroomAssets(days);
    }

    this.logger.log('Expiration check completed.');
  }

  private async processExpiringAssets(daysUntilExpiry: number): Promise<void> {
    const targetDate = this.getTargetDate(daysUntilExpiry);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const assets = await this.assetModel
      .find({
        expirationDate: { $gte: startOfDay, $lte: endOfDay },
        expirationNotificationsEnabled: true,
        type: { $ne: 'FILES' },
      })
      .exec();

    for (const asset of assets) {
      if (this.hasNotificationBeenSent(asset.notificationsSentAt, daysUntilExpiry)) {
        continue;
      }

      try {
        await this.createAndSendAssetNotification(asset, daysUntilExpiry);
        await this.markNotificationSent(asset._id, daysUntilExpiry);
      } catch (error) {
        this.logger.error(
          `Failed to process asset ${asset._id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async processExpiringShowroomAssets(
    daysUntilExpiry: number,
  ): Promise<void> {
    const targetDate = this.getTargetDate(daysUntilExpiry);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const assets = await this.showroomAssetModel
      .find({
        expirationDate: { $gte: startOfDay, $lte: endOfDay },
        expirationNotificationsEnabled: true,
        type: { $ne: 'FILES' },
      })
      .exec();

    for (const asset of assets) {
      if (this.hasNotificationBeenSent(asset.notificationsSentAt, daysUntilExpiry)) {
        continue;
      }

      try {
        await this.createAndSendShowroomAssetNotification(asset, daysUntilExpiry);
        await this.markShowroomAssetNotificationSent(asset._id, daysUntilExpiry);
      } catch (error) {
        this.logger.error(
          `Failed to process showroom asset ${asset._id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async createAndSendAssetNotification(
    asset: AssetDocument,
    daysUntilExpiry: number,
  ): Promise<void> {
    const client = await this.clientModel.findById(asset.clientId).exec();
    if (!client) return;

    const users = await this.userModel
      .find({ tenantId: asset.tenantId, isActive: true })
      .exec();

    const notificationType =
      daysUntilExpiry === 0
        ? NotificationType.EXPIRATION_TODAY
        : NotificationType.EXPIRATION_REMINDER;

    const title =
      daysUntilExpiry === 0
        ? `"${asset.name}" expires TODAY!`
        : `"${asset.name}" expires in ${daysUntilExpiry} days`;

    const message =
      daysUntilExpiry === 0
        ? `The asset "${asset.name}" is expiring today. Please take action to renew.`
        : `The asset "${asset.name}" will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Please plan for renewal.`;

    // Create notification for all users in the tenant
    await this.notificationsService.create({
      title,
      message,
      type: notificationType,
      tenantId: asset.tenantId,
      clientId: asset.clientId,
      assetId: asset._id,
      assetName: asset.name,
      daysUntilExpiry,
    });

    // Send email to all active users
    for (const user of users) {
      try {
        await this.mailService.sendExpirationReminderEmail({
          to: user.email,
          name: user.name,
          assetName: asset.name,
          daysUntilExpiry,
          clientName: client.name,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async createAndSendShowroomAssetNotification(
    asset: ShowroomAssetDocument,
    daysUntilExpiry: number,
  ): Promise<void> {
    const [client, showroom] = await Promise.all([
      this.clientModel.findById(asset.clientId).exec(),
      this.showroomModel.findById(asset.showroomId).exec(),
    ]);

    if (!client || !showroom) return;

    const users = await this.userModel
      .find({ tenantId: asset.tenantId, isActive: true })
      .exec();

    const notificationType =
      daysUntilExpiry === 0
        ? NotificationType.EXPIRATION_TODAY
        : NotificationType.EXPIRATION_REMINDER;

    const title =
      daysUntilExpiry === 0
        ? `"${asset.name}" in "${showroom.name}" expires TODAY!`
        : `"${asset.name}" in "${showroom.name}" expires in ${daysUntilExpiry} days`;

    const message =
      daysUntilExpiry === 0
        ? `The asset "${asset.name}" in showroom "${showroom.name}" is expiring today. Please take action to renew.`
        : `The asset "${asset.name}" in showroom "${showroom.name}" will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Please plan for renewal.`;

    // Create notification for all users in the tenant
    await this.notificationsService.create({
      title,
      message,
      type: notificationType,
      tenantId: asset.tenantId,
      clientId: asset.clientId,
      showroomAssetId: asset._id,
      assetName: asset.name,
      showroomName: showroom.name,
      daysUntilExpiry,
    });

    // Send email to all active users
    for (const user of users) {
      try {
        await this.mailService.sendExpirationReminderEmail({
          to: user.email,
          name: user.name,
          assetName: asset.name,
          daysUntilExpiry,
          clientName: client.name,
          showroomName: showroom.name,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send email to ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private getTargetDate(daysFromNow: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  }

  private hasNotificationBeenSent(
    sentDates: Date[] | undefined,
    daysUntilExpiry: number,
  ): boolean {
    if (!sentDates || sentDates.length === 0) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if a notification for this reminder day has been sent today
    return sentDates.some((sentDate) => {
      const sent = new Date(sentDate);
      sent.setHours(0, 0, 0, 0);
      return sent.getTime() === today.getTime();
    });
  }

  private async markNotificationSent(
    assetId: Types.ObjectId | undefined,
    daysUntilExpiry: number,
  ): Promise<void> {
    if (!assetId) return;

    await this.assetModel
      .findByIdAndUpdate(assetId, {
        $push: { notificationsSentAt: new Date() },
      })
      .exec();
  }

  private async markShowroomAssetNotificationSent(
    assetId: Types.ObjectId | undefined,
    daysUntilExpiry: number,
  ): Promise<void> {
    if (!assetId) return;

    await this.showroomAssetModel
      .findByIdAndUpdate(assetId, {
        $push: { notificationsSentAt: new Date() },
      })
      .exec();
  }
}
