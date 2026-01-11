import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async create(dto: CreateRoleDto) {
    const name = this.normalizeName(dto.name);
    const existing = await this.roleModel.findOne({ name }).lean();
    if (existing) {
      throw new BadRequestException('Role already exists');
    }

    const role = await this.roleModel.create({
      name,
      description: dto.description?.trim(),
      isActive: dto.isActive ?? true,
    });

    return { role: this.serialize(role) };
  }

  async list() {
    const roles = await this.roleModel.find().sort({ name: 1 }).lean();
    return { roles: roles.map((role) => this.serialize(role)) };
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (dto.name) {
      const name = this.normalizeName(dto.name);
      const existing = await this.roleModel.findOne({
        name,
        _id: { $ne: role._id },
      });
      if (existing) {
        throw new BadRequestException('Role already exists');
      }
      role.name = name;
    }

    if (dto.description !== undefined) {
      role.description = dto.description?.trim();
    }

    if (dto.isActive !== undefined) {
      role.isActive = dto.isActive;
    }

    await role.save();

    return { role: this.serialize(role) };
  }

  async remove(id: string) {
    const role = await this.roleModel.findByIdAndDelete(id).lean();
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return { deleted: true };
  }

  async findById(id: string) {
    return this.roleModel.findById(id).lean();
  }

  private normalizeName(name: string) {
    return name.trim().toUpperCase();
  }

  private serialize(role: Role | RoleDocument) {
    const rawId = (role as RoleDocument & { _id?: unknown })._id;
    return {
      id: rawId ? rawId.toString() : undefined,
      name: role.name,
      description: role.description ?? null,
      isActive: role.isActive,
    };
  }
}
