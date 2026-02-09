import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Asset, AssetSchema } from '../assets/schemas/asset.schema';
import {
  Showroom,
  ShowroomSchema,
  ShowroomAsset,
  ShowroomAssetSchema,
} from '../showrooms/schemas/showroom.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: User.name, schema: UserSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: Showroom.name, schema: ShowroomSchema },
      { name: ShowroomAsset.name, schema: ShowroomAssetSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
