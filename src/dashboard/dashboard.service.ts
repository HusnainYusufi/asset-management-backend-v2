import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client } from '../clients/schemas/client.schema';
import { User } from '../users/schemas/user.schema';
import { Asset } from '../assets/schemas/asset.schema';
import { Showroom, ShowroomAsset } from '../showrooms/schemas/showroom.schema';
import { Notification } from '../notifications/schemas/notification.schema';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectModel(Showroom.name) private readonly showroomModel: Model<Showroom>,
    @InjectModel(ShowroomAsset.name)
    private readonly showroomAssetModel: Model<ShowroomAsset>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  async getStats(user: AuthenticatedUser) {
    const { tenantId, roleName } = user;

    if (roleName === 'SUPERADMIN') {
      return this.getSuperadminStats(tenantId);
    }

    return this.getClientStats(tenantId, user.clientId);
  }

  private async getSuperadminStats(tenantId: string) {
    const [clients, users, assets, showrooms, showroomAssets, unreadNotifications] =
      await Promise.all([
        this.clientModel.countDocuments({ tenantId }),
        this.userModel.countDocuments({ tenantId }),
        this.assetModel.countDocuments({ tenantId }),
        this.showroomModel.countDocuments({ tenantId }),
        this.showroomAssetModel.countDocuments({ tenantId }),
        this.notificationModel.countDocuments({ tenantId, isRead: false }),
      ]);

    return {
      role: 'SUPERADMIN',
      stats: {
        clients,
        users,
        assets,
        showrooms,
        showroomAssets,
        unreadNotifications,
      },
    };
  }

  private async getClientStats(tenantId: string, clientId?: string) {
    const clientOid = clientId ? new Types.ObjectId(clientId) : undefined;
    const filter: Record<string, unknown> = { tenantId };
    if (clientOid) {
      filter.clientId = clientOid;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const [assets, showrooms, showroomAssets, unreadNotifications, expiringSoon] =
      await Promise.all([
        this.assetModel.countDocuments(filter),
        this.showroomModel.countDocuments(filter),
        this.showroomAssetModel.countDocuments(filter),
        this.notificationModel.countDocuments({ ...filter, isRead: false }),
        this.assetModel.countDocuments({
          ...filter,
          expirationDate: { $gte: now, $lte: thirtyDaysFromNow },
        }),
      ]);

    return {
      role: 'CLIENT',
      stats: {
        assets,
        showrooms,
        showroomAssets,
        unreadNotifications,
        expiringSoon,
      },
    };
  }
}
