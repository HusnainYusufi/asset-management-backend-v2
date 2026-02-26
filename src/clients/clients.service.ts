import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { rm } from 'fs/promises';
import { join } from 'path';
import { Client, ClientDocument } from './schemas/client.schema';
import { Asset, AssetDocument } from '../assets/schemas/asset.schema';
import {
  Showroom,
  ShowroomDocument,
  ShowroomAsset,
  ShowroomAssetDocument,
} from '../showrooms/schemas/showroom.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Notification,
  NotificationDocument,
} from '../notifications/schemas/notification.schema';

@Injectable()
export class ClientsService {
  private readonly uploadsRoot = process.env.UPLOADS_DIR ?? 'uploads';

  constructor(
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Asset.name)
    private readonly assetModel: Model<AssetDocument>,
    @InjectModel(Showroom.name)
    private readonly showroomModel: Model<ShowroomDocument>,
    @InjectModel(ShowroomAsset.name)
    private readonly showroomAssetModel: Model<ShowroomAssetDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async findAll() {
    return this.clientModel.find().lean();
  }

  async findById(id: string) {
    return this.clientModel.findById(id).lean();
  }

  async deleteClient(clientId: string) {
    const client = await this.clientModel.findById(clientId);

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const clientTenantId = client.tenantId;
    const clientObjectId = client._id;

    // Delete all related data in parallel
    await Promise.all([
      this.assetModel.deleteMany({
        clientId: clientObjectId,
        tenantId: clientTenantId,
      }),
      this.showroomAssetModel.deleteMany({
        clientId: clientObjectId,
        tenantId: clientTenantId,
      }),
      this.showroomModel.deleteMany({
        clientId: clientObjectId,
        tenantId: clientTenantId,
      }),
      this.notificationModel.deleteMany({
        clientId: clientObjectId,
        tenantId: clientTenantId,
      }),
      this.userModel.deleteMany({ clientId: clientObjectId }),
    ]);

    // Delete the client itself
    await this.clientModel.findByIdAndDelete(clientObjectId);

    // Remove all uploaded files for this client
    const clientDir = join(
      process.cwd(),
      this.uploadsRoot,
      clientTenantId,
      clientId,
    );
    await rm(clientDir, { recursive: true, force: true }).catch(() => {
      // Directory may not exist, ignore
    });

    return { message: 'Client and all related data deleted successfully' };
  }
}
