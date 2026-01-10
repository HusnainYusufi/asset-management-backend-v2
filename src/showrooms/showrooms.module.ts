import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowroomsController } from './showrooms.controller';
import { ShowroomsService } from './showrooms.service';
import {
  Showroom,
  ShowroomSchema,
  ShowroomAsset,
  ShowroomAssetSchema,
} from './schemas/showroom.schema';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Showroom.name, schema: ShowroomSchema },
      { name: ShowroomAsset.name, schema: ShowroomAssetSchema },
    ]),
    CryptoModule,
  ],
  controllers: [ShowroomsController],
  providers: [ShowroomsService],
})
export class ShowroomsModule {}
