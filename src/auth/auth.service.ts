import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { OnboardDto } from './dto/onboard.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onboard(dto: OnboardDto) {
    const existingUser = await this.userModel
      .findOne({ email: dto.ownerEmail })
      .lean();
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const tenantId = randomUUID();
    const client = await this.clientModel.create({
      name: dto.clientName,
      tenantId,
      isActive: true,
    });

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 12);
    const owner = await this.userModel.create({
      email: dto.ownerEmail,
      name: dto.ownerName,
      passwordHash,
      role: UserRole.OWNER,
      tenantId,
      clientId: client._id,
      isActive: true,
    });

    const accessToken = await this.signToken({
      userId: owner.id,
      tenantId,
      role: owner.role,
      clientId: client.id,
    });

    return {
      accessToken,
      user: this.sanitizeUser(owner),
      client: {
        id: client.id,
        name: client.name,
        tenantId: client.tenantId,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email }).exec();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.signToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      clientId: user.clientId?.toString(),
    });

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { user: this.sanitizeUser(user) };
  }

  private async signToken(payload: AuthenticatedUser) {
    return this.jwtService.signAsync(payload, {
      issuer: this.configService.get<string>('BASE_URL') ?? 'asset-management',
    });
  }

  private sanitizeUser(user: User | UserDocument) {
    const id =
      'id' in user
        ? user.id
        : (user as { _id?: Types.ObjectId })._id?.toString();
    return {
      id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      clientId: user.clientId?.toString(),
    };
  }
}
