import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string) {
    return this.userModel.findById(id).lean();
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.role !== UserRole.SUPERADMIN && !dto.clientId && !user.clientId) {
      throw new BadRequestException('Client ID is required for this role');
    }

    user.role = dto.role;
    if (dto.clientId) {
      user.clientId = new Types.ObjectId(dto.clientId);
    }
    await user.save();

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        clientId: user.clientId?.toString(),
      },
    };
  }
}
