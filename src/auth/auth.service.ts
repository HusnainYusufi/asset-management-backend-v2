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
import { createHash, randomInt, randomUUID } from 'crypto';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { OnboardDto } from './dto/onboard.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { MailService } from '../common/mail/mail.service';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupSuperAdminDto } from './dto/setup-superadmin.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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

  async setupSuperAdmin(dto: SetupSuperAdminDto) {
    const setupKey = this.configService.get<string>('SUPERADMIN_SETUP_KEY');
    if (!setupKey || dto.setupKey !== setupKey) {
      throw new BadRequestException('Invalid setup key');
    }

    const existing = await this.userModel
      .findOne({ role: UserRole.SUPERADMIN })
      .lean();
    if (existing) {
      throw new BadRequestException('Superadmin already exists');
    }

    const existingEmail = await this.userModel
      .findOne({ email: dto.email })
      .lean();
    if (existingEmail) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const superadmin = await this.userModel.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: UserRole.SUPERADMIN,
      tenantId: 'system',
      isActive: true,
    });

    const accessToken = await this.signToken({
      userId: superadmin.id,
      tenantId: superadmin.tenantId,
      role: superadmin.role,
    });

    return {
      accessToken,
      user: this.sanitizeUser(superadmin),
    };
  }

  async requestPasswordReset(dto: ResetPasswordRequestDto) {
    const user = await this.userModel.findOne({ email: dto.email }).exec();
    if (!user || !user.isActive) {
      return { sent: true };
    }

    const token = this.generateResetToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = expiresAt;
    await user.save();

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token,
    });

    return { sent: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const now = new Date();
    const user = await this.userModel.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: now },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    user.passwordHash = passwordHash;
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();

    return { reset: true };
  }

  private async signToken(payload: AuthenticatedUser) {
    return this.jwtService.signAsync(payload, {
      issuer: this.configService.get<string>('BASE_URL') ?? 'asset-management',
    });
  }

  private generateResetToken() {
    return String(randomInt(100000, 1000000));
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
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
