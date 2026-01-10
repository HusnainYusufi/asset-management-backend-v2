import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { OnboardDto } from './dto/onboard.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { InviteClientDto } from './dto/invite-client.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupSuperAdminDto } from './dto/setup-superadmin.dto';
import { MailService } from '../common/mail/mail.service';

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
    if (!user || !user.isActive || !user.passwordHash) {
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
    const setupKey = this.configService.get<string>('SUPER_ADMIN_SETUP_KEY');
    if (!setupKey || dto.setupKey !== setupKey) {
      throw new UnauthorizedException('Invalid setup key');
    }

    const existingSuperAdmin = await this.userModel
      .findOne({ role: UserRole.SUPER_ADMIN })
      .lean();
    if (existingSuperAdmin) {
      throw new BadRequestException('Super admin already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const superAdmin = await this.userModel.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      tenantId: 'platform',
      isActive: true,
    });

    const accessToken = await this.signToken({
      userId: superAdmin.id,
      tenantId: superAdmin.tenantId,
      role: superAdmin.role,
    });

    return {
      accessToken,
      user: this.sanitizeUser(superAdmin),
    };
  }

  async inviteClient(dto: InviteClientDto, invitedBy: string) {
    const existingUser = await this.userModel
      .findOne({ email: dto.contactEmail })
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

    const { token, tokenHash, expiresAt } = this.generateToken();
    const user = await this.userModel.create({
      email: dto.contactEmail,
      name: dto.contactName,
      role: UserRole.CLIENT_USER,
      tenantId,
      clientId: client._id,
      isActive: true,
      invitationTokenHash: tokenHash,
      invitationExpiresAt: expiresAt,
      invitedBy,
    });

    await this.mailService.sendInvitationEmail({
      to: user.email,
      name: user.name,
      token,
      clientName: client.name,
    });

    return {
      client: { id: client.id, name: client.name, tenantId: client.tenantId },
      user: this.sanitizeUser(user),
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.userModel.findOne({
      invitationTokenHash: tokenHash,
      invitationExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired invitation token');
    }

    user.passwordHash = await bcrypt.hash(dto.password, 12);
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    await user.save();

    const accessToken = await this.signToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      clientId: user.clientId?.toString(),
    });

    return { accessToken, user: this.sanitizeUser(user) };
  }

  async requestPasswordReset(dto: ResetPasswordRequestDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      return { message: 'If the account exists, a reset link was sent.' };
    }

    const { token, tokenHash, expiresAt } = this.generateToken();
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expiresAt;
    await user.save();

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token,
    });

    return { message: 'If the account exists, a reset link was sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.userModel.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(dto.password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    return { message: 'Password updated successfully' };
  }

  private async signToken(payload: AuthenticatedUser) {
    return this.jwtService.signAsync(payload, {
      issuer: this.configService.get<string>('BASE_URL') ?? 'asset-management',
    });
  }

  private sanitizeUser(user: User | UserDocument) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      clientId: user.clientId?.toString(),
    };
  }

  private generateToken() {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
