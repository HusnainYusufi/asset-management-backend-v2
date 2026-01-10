import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, relative, sep, posix } from 'path';
import { EncryptionService } from '../common/crypto/encryption.service';
import {
  Showroom,
  ShowroomAsset,
  ShowroomAssetDocument,
  ShowroomAssetField,
  ShowroomAssetFieldType,
  ShowroomAssetFile,
  ShowroomAssetType,
  ShowroomDocument,
  ShowroomTemplate,
} from './schemas/showroom.schema';
import { CreateShowroomDto } from './dto/create-showroom.dto';
import { UpdateShowroomDto } from './dto/update-showroom.dto';
import { CreateShowroomAssetDto } from './dto/create-showroom-asset.dto';
import { UpdateShowroomAssetDto } from './dto/update-showroom-asset.dto';
import { ShowroomTemplateDto } from './dto/showroom-meta.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { ShowroomAssetFieldDto } from './dto/showroom-asset-field.dto';

interface EncryptedPayload {
  cipherText: string;
  iv: string;
  tag: string;
}

type ShowroomTemplateResponse = ShowroomTemplate & {
  _id?: Types.ObjectId | string;
  id?: string;
};

type ShowroomResponseInput = Omit<Showroom, 'clientId' | 'templates'> & {
  _id?: Types.ObjectId | string;
  id?: string;
  clientId?: Types.ObjectId | string;
  templates?: Types.DocumentArray<ShowroomTemplate> | ShowroomTemplateResponse[];
};

type ShowroomAssetResponseFile = ShowroomAssetFile & {
  _id?: Types.ObjectId | string;
  id?: string;
};

type ShowroomAssetResponseInput = Omit<
  ShowroomAsset,
  'clientId' | 'showroomId' | 'files'
> & {
  _id?: Types.ObjectId | string;
  id?: string;
  clientId?: Types.ObjectId | string;
  showroomId?: Types.ObjectId | string;
  files?: Types.DocumentArray<ShowroomAssetFile> | ShowroomAssetResponseFile[];
};

@Injectable()
export class ShowroomsService {
  private readonly uploadsRoot: string;

  constructor(
    @InjectModel(Showroom.name)
    private readonly showroomModel: Model<ShowroomDocument>,
    @InjectModel(ShowroomAsset.name)
    private readonly showroomAssetModel: Model<ShowroomAssetDocument>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {
    this.uploadsRoot =
      this.configService.get<string>('UPLOADS_DIR') ?? 'uploads';
  }

  async createShowroom(dto: CreateShowroomDto, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const showroom = await this.showroomModel.create({
      name: dto.name,
      location: dto.location,
      tenantId: user.tenantId,
      clientId,
      metaFields: dto.metaFields ?? [],
      templates: dto.templates ?? [],
    });

    return { showroom: this.toShowroomResponse(showroom) };
  }

  async listShowrooms(user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const showrooms = await this.showroomModel
      .find({ tenantId: user.tenantId, clientId })
      .sort({ createdAt: -1 })
      .lean();

    return { showrooms: showrooms.map((s) => this.toShowroomResponse(s)) };
  }

  async getShowroom(id: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const showroom = await this.showroomModel
      .findOne({ _id: id, tenantId: user.tenantId, clientId })
      .lean();
    if (!showroom) {
      throw new NotFoundException('Showroom not found');
    }
    return { showroom: this.toShowroomResponse(showroom) };
  }

  async updateShowroom(
    id: string,
    dto: UpdateShowroomDto,
    user: AuthenticatedUser,
  ) {
    const clientId = this.requireClientId(user);
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.location !== undefined) updatePayload.location = dto.location;
    if (dto.metaFields !== undefined) updatePayload.metaFields = dto.metaFields;
    if (dto.templates !== undefined) updatePayload.templates = dto.templates;

    const showroom = await this.showroomModel
      .findOneAndUpdate(
        { _id: id, tenantId: user.tenantId, clientId },
        { $set: updatePayload },
        { new: true },
      )
      .lean();

    if (!showroom) {
      throw new NotFoundException('Showroom not found');
    }

    return { showroom: this.toShowroomResponse(showroom) };
  }

  async removeShowroom(id: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const showroom = await this.showroomModel.findOneAndDelete({
      _id: id,
      tenantId: user.tenantId,
      clientId,
    });

    if (!showroom) {
      throw new NotFoundException('Showroom not found');
    }

    await this.showroomAssetModel.deleteMany({
      tenantId: user.tenantId,
      clientId,
      showroomId: showroom._id,
    });
    await this.removeShowroomFiles(showroom.id, user);

    return { deleted: true };
  }

  async addTemplate(
    showroomId: string,
    dto: ShowroomTemplateDto,
    user: AuthenticatedUser,
  ) {
    const showroom = await this.getShowroomEntity(showroomId, user);
    showroom.templates.push({
      name: dto.name,
      description: dto.description,
      sizes: this.normalizeTemplateSizes(dto.sizes),
      metaFields: dto.metaFields ?? [],
    });
    await showroom.save();
    return { showroom: this.toShowroomResponse(showroom) };
  }

  async updateTemplate(
    showroomId: string,
    templateId: string,
    dto: ShowroomTemplateDto,
    user: AuthenticatedUser,
  ) {
    const showroom = await this.getShowroomEntity(showroomId, user);
    const template = showroom.templates.id(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    template.set({
      name: dto.name ?? template.name,
      description: dto.description ?? template.description,
      sizes:
        dto.sizes === undefined
          ? template.sizes
          : this.normalizeTemplateSizes(dto.sizes),
      metaFields: dto.metaFields ?? template.metaFields,
    });
    await showroom.save();
    return { showroom: this.toShowroomResponse(showroom) };
  }

  async removeTemplate(
    showroomId: string,
    templateId: string,
    user: AuthenticatedUser,
  ) {
    const showroom = await this.getShowroomEntity(showroomId, user);
    const template = showroom.templates.id(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    template.deleteOne();
    await showroom.save();
    return { showroom: this.toShowroomResponse(showroom) };
  }

  async createAsset(
    showroomId: string,
    dto: CreateShowroomAssetDto,
    user: AuthenticatedUser,
  ) {
    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const fields = this.mapFieldsForStorage(dto.fields ?? []);
    const asset = await this.showroomAssetModel.create({
      name: dto.name,
      description: dto.description,
      type: dto.type ?? ShowroomAssetType.GENERAL,
      tenantId: user.tenantId,
      clientId,
      showroomId,
      fields,
      tags: dto.tags ?? [],
    });

    return { asset: this.toAssetResponse(asset) };
  }

  async listAssets(showroomId: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const assets = await this.showroomAssetModel
      .find({ tenantId: user.tenantId, clientId, showroomId })
      .sort({ createdAt: -1 })
      .lean();

    return { assets: assets.map((asset) => this.toAssetResponse(asset)) };
  }

  async getAsset(showroomId: string, assetId: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const asset = await this.showroomAssetModel
      .findOne({ _id: assetId, tenantId: user.tenantId, clientId, showroomId })
      .lean();
    if (!asset) {
      throw new NotFoundException('Showroom asset not found');
    }
    return { asset: this.toAssetResponse(asset) };
  }

  async updateAsset(
    showroomId: string,
    assetId: string,
    dto: UpdateShowroomAssetDto,
    user: AuthenticatedUser,
  ) {
    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.description !== undefined)
      updatePayload.description = dto.description;
    if (dto.type !== undefined) updatePayload.type = dto.type;
    if (dto.tags !== undefined) updatePayload.tags = dto.tags;
    if (dto.fields !== undefined) {
      updatePayload.fields = this.mapFieldsForStorage(dto.fields ?? []);
    }

    const asset = await this.showroomAssetModel
      .findOneAndUpdate(
        { _id: assetId, tenantId: user.tenantId, clientId, showroomId },
        { $set: updatePayload },
        { new: true },
      )
      .lean();

    if (!asset) {
      throw new NotFoundException('Showroom asset not found');
    }

    return { asset: this.toAssetResponse(asset) };
  }

  async removeAsset(
    showroomId: string,
    assetId: string,
    user: AuthenticatedUser,
  ) {
    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const asset = await this.showroomAssetModel.findOneAndDelete({
      _id: assetId,
      tenantId: user.tenantId,
      clientId,
      showroomId,
    });

    if (!asset) {
      throw new NotFoundException('Showroom asset not found');
    }

    await this.removeShowroomAssetFiles(showroomId, assetId, user);

    return { deleted: true };
  }

  async addAssetFiles(
    showroomId: string,
    assetId: string,
    files: Express.Multer.File[],
    user: AuthenticatedUser,
  ) {
    if (!files.length) {
      throw new BadRequestException('No files uploaded');
    }

    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const asset = await this.showroomAssetModel.findOne({
      _id: assetId,
      tenantId: user.tenantId,
      clientId,
      showroomId,
    });

    if (!asset) {
      throw new NotFoundException('Showroom asset not found');
    }

    const newFiles = files.map((file) => {
      const relativePath = this.toRelativePath(file.path);
      return {
        filename: file.filename,
        originalName: file.originalname,
        relativePath,
        url: `/${relativePath}`,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: user.userId,
        uploadedAt: new Date(),
      };
    });

    asset.files.push(...newFiles);
    await asset.save();

    return { asset: this.toAssetResponse(asset) };
  }

  async removeAssetFile(
    showroomId: string,
    assetId: string,
    fileId: string,
    user: AuthenticatedUser,
  ) {
    const clientId = this.requireClientId(user);
    await this.getShowroomEntity(showroomId, user);
    const asset = await this.showroomAssetModel.findOne({
      _id: assetId,
      tenantId: user.tenantId,
      clientId,
      showroomId,
    });

    if (!asset) {
      throw new NotFoundException('Showroom asset not found');
    }

    const file = asset.files.id(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const relativePath = file.relativePath;
    file.deleteOne();
    await asset.save();

    await fs.rm(join(process.cwd(), relativePath), { force: true });

    return { asset: this.toAssetResponse(asset) };
  }

  private requireClientId(user: AuthenticatedUser) {
    if (!user.clientId) {
      throw new BadRequestException('Client scope is required');
    }
    return new Types.ObjectId(user.clientId);
  }

  private async getShowroomEntity(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ShowroomDocument> {
    const clientId = this.requireClientId(user);
    const showroom = await this.showroomModel.findOne({
      _id: id,
      tenantId: user.tenantId,
      clientId,
    });
    if (!showroom) {
      throw new NotFoundException('Showroom not found');
    }
    return showroom;
  }

  private mapFieldsForStorage(fields: ShowroomAssetFieldDto[]) {
    return fields.map((field) => {
      const isSecret = !!field.isSecret;
      const value = field.value ?? '';
      if (isSecret) {
        const encrypted = this.encryptionService.encrypt(value);
        return {
          key: field.key,
          type: field.type ?? ShowroomAssetFieldType.TEXT,
          isSecret: true,
          encryptedValue: encrypted.cipherText,
          iv: encrypted.iv,
          tag: encrypted.tag,
        };
      }
      return {
        key: field.key,
        type: field.type ?? ShowroomAssetFieldType.TEXT,
        isSecret: false,
        value,
      };
    });
  }

  private normalizeTemplateSizes(sizes?: ShowroomTemplateDto['sizes']) {
    return (sizes ?? []).map((size) => ({
      label: size.label,
      width: size.width,
      height: size.height,
      unit: size.unit ?? 'px',
    }));
  }

  private toShowroomResponse(showroom: ShowroomResponseInput) {
    const id = showroom.id ?? (showroom._id ? showroom._id.toString() : '');
    return {
      id,
      name: showroom.name,
      location: showroom.location,
      tenantId: showroom.tenantId,
      clientId: showroom.clientId?.toString?.() ?? showroom.clientId,
      metaFields: showroom.metaFields ?? [],
      templates: (showroom.templates ?? []).map((template) => ({
        id: template.id ?? (template._id ? template._id.toString() : ''),
        name: template.name,
        description: template.description,
        sizes: template.sizes ?? [],
        metaFields: template.metaFields ?? [],
      })),
      createdAt: (showroom as { createdAt?: Date }).createdAt,
      updatedAt: (showroom as { updatedAt?: Date }).updatedAt,
    };
  }

  private toAssetResponse(asset: ShowroomAssetResponseInput) {
    const id = asset.id ?? (asset._id ? asset._id.toString() : '');
    return {
      id,
      name: asset.name,
      description: asset.description,
      type: asset.type,
      tenantId: asset.tenantId,
      clientId: asset.clientId?.toString?.() ?? asset.clientId,
      showroomId: asset.showroomId?.toString?.() ?? asset.showroomId,
      tags: asset.tags ?? [],
      fields: (asset.fields ?? []).map((field) =>
        this.mapFieldForResponse(field),
      ),
      files: (asset.files ?? []).map((file) => ({
        id: file.id ?? (file._id ? file._id.toString() : ''),
        filename: file.filename,
        originalName: file.originalName,
        relativePath: file.relativePath,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt,
      })),
      createdAt: (asset as { createdAt?: Date }).createdAt,
      updatedAt: (asset as { updatedAt?: Date }).updatedAt,
    };
  }

  private mapFieldForResponse(field: ShowroomAssetField) {
    if (field.isSecret) {
      const payload: EncryptedPayload = {
        cipherText: field.encryptedValue ?? '',
        iv: field.iv ?? '',
        tag: field.tag ?? '',
      };
      const value = this.encryptionService.decrypt(payload);
      return {
        key: field.key,
        type: field.type,
        isSecret: true,
        value,
      };
    }

    return {
      key: field.key,
      type: field.type,
      isSecret: false,
      value: field.value ?? '',
    };
  }

  private toRelativePath(filePath: string) {
    const relativePath = relative(process.cwd(), filePath)
      .split(sep)
      .join(posix.sep);
    return relativePath.startsWith('uploads')
      ? relativePath
      : posix.join(this.uploadsRoot, relativePath);
  }

  private async removeShowroomFiles(
    showroomId: string,
    user: AuthenticatedUser,
  ) {
    const folderPath = join(
      process.cwd(),
      this.uploadsRoot,
      user.tenantId,
      user.clientId ?? '',
      'showrooms',
      showroomId,
    );

    await fs.rm(folderPath, { recursive: true, force: true });
  }

  private async removeShowroomAssetFiles(
    showroomId: string,
    assetId: string,
    user: AuthenticatedUser,
  ) {
    const folderPath = join(
      process.cwd(),
      this.uploadsRoot,
      user.tenantId,
      user.clientId ?? '',
      'showrooms',
      showroomId,
      assetId,
    );

    await fs.rm(folderPath, { recursive: true, force: true });
  }
}
