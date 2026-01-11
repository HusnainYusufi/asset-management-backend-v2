import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { UsersModule } from './users/users.module';
import { AssetsModule } from './assets/assets.module';
import { ShowroomsModule } from './showrooms/showrooms.module';
import { RolesModule } from './roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGO_URI');
        if (!uri) {
          throw new Error('MONGO_URI is not set');
        }
        return { uri };
      },
    }),
    AuthModule,
    ClientsModule,
    UsersModule,
    RolesModule,
    AssetsModule,
    ShowroomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
