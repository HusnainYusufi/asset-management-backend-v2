import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpirationCheckerService } from './expiration-checker.service';
import { Asset, AssetSchema } from '../assets/schemas/asset.schema';
import {
  ShowroomAsset,
  ShowroomAssetSchema,
  Showroom,
  ShowroomSchema,
} from '../showrooms/schemas/showroom.schema';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MailModule } from '../common/mail/mail.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: ShowroomAsset.name, schema: ShowroomAssetSchema },
      { name: Showroom.name, schema: ShowroomSchema },
      { name: Client.name, schema: ClientSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MailModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpirationCheckerService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
