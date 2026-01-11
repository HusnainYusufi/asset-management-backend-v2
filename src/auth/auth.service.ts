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
import { User, UserDocument } from '../users/schemas/user.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
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
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
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

    const ownerRole = await this.findRoleOrFail(dto.ownerRoleId);
    const passwordHash = await bcrypt.hash(dto.ownerPassword, 12);
    const owner = await this.userModel.create({
      email: dto.ownerEmail,
      name: dto.ownerName,
      passwordHash,
      roleId: ownerRole._id,
      tenantId,
      clientId: client._id,
      isActive: true,
    });

    const accessToken = await this.signToken({
      userId: owner._id.toString(),
      tenantId,
      roleId: owner.roleId.toString(),
      roleName: ownerRole.name,
      clientId: client._id.toString(),
    });

    return {
      accessToken,
      user: await this.sanitizeUser(owner, ownerRole),
      client: {
        id: client._id.toString(),
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

    const role = await this.roleModel.findById(user.roleId).lean();
    if (!role) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.signToken({
      userId: user._id.toString(),
      tenantId: user.tenantId,
      roleId: user.roleId.toString(),
      roleName: role.name,
      clientId: user.clientId?.toString(),
    });

    return {
      accessToken,
      user: await this.sanitizeUser(user, role),
    };
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { user: await this.sanitizeUser(user) };
  }

  async setupSuperAdmin(dto: SetupSuperAdminDto) {
    const setupKey = this.configService.get<string>('SUPERADMIN_SETUP_KEY');
    if (!setupKey || dto.setupKey !== setupKey) {
      throw new BadRequestException('Invalid setup key');
    }

    const superadminRole = await this.findRoleOrFail(dto.roleId);
    if (superadminRole.name !== 'SUPERADMIN') {
      throw new BadRequestException('Role must be SUPERADMIN');
    }

    const existing = await this.userModel
      .findOne({ roleId: superadminRole._id })
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
      roleId: superadminRole._id,
      tenantId: 'system',
      isActive: true,
    });

    const accessToken = await this.signToken({
      userId: superadmin._id.toString(),
      tenantId: superadmin.tenantId,
      roleId: superadmin.roleId.toString(),
      roleName: superadminRole.name,
    });

    return {
      accessToken,
      user: await this.sanitizeUser(superadmin, superadminRole),
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

  private async sanitizeUser(
    user: UserDocument | (User & { _id?: Types.ObjectId | string }),
    role?: Role | RoleDocument,
  ) {
    const rawId = (user as { _id?: Types.ObjectId | string })._id;
    const id = rawId ? rawId.toString() : undefined;
    const resolvedRole =
      role ?? (await this.roleModel.findById(user.roleId).lean());
    return {
      id,
      email: user.email,
      name: user.name,
      roleId: user.roleId?.toString(),
      roleName: resolvedRole?.name,
      tenantId: user.tenantId,
      clientId: user.clientId?.toString(),
    };
  }

  private async findRoleOrFail(roleId: string) {
    const role = await this.roleModel.findById(roleId).lean();
    if (!role) {
      throw new BadRequestException('Role not found');
    }
    return role;
  }
}
