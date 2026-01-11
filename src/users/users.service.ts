import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async findById(id: string) {
    return this.userModel.findById(id).lean();
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.roleModel.findById(dto.roleId).lean();
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    if (role.name !== 'SUPERADMIN' && !dto.clientId && !user.clientId) {
      throw new BadRequestException('Client ID is required for this role');
    }

    user.roleId = new Types.ObjectId(dto.roleId);
    if (dto.clientId) {
      user.clientId = new Types.ObjectId(dto.clientId);
    }
    await user.save();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        roleId: user.roleId.toString(),
        roleName: role.name,
        tenantId: user.tenantId,
        clientId: user.clientId?.toString(),
      },
    };
  }
}
