import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from './schemas/client.schema';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Asset, AssetSchema } from '../assets/schemas/asset.schema';
import {
  Showroom,
  ShowroomSchema,
  ShowroomAsset,
  ShowroomAssetSchema,
} from '../showrooms/schemas/showroom.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: Showroom.name, schema: ShowroomSchema },
      { name: ShowroomAsset.name, schema: ShowroomAssetSchema },
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
