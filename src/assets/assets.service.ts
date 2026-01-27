import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { promises as fs } from 'fs';
import { join, relative, sep, posix } from 'path';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../common/crypto/encryption.service';
import {
  Asset,
  AssetDocument,
  AssetField,
  AssetFieldType,
  AssetFile,
  AssetType,
} from './schemas/asset.schema';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { AssetFieldDto } from './dto/asset-field.dto';

interface EncryptedPayload {
  cipherText: string;
  iv: string;
  tag: string;
}

type AssetResponseFile = AssetFile & {
  _id?: Types.ObjectId | string;
  id?: string;
};

type AssetResponseInput = Omit<Asset, 'clientId' | 'files'> & {
  _id?: Types.ObjectId | string;
  id?: string;
  clientId?: Types.ObjectId | string;
  files?: Types.DocumentArray<AssetFile> | AssetResponseFile[];
};

@Injectable()
export class AssetsService {
  private readonly uploadsRoot: string;

  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {
    this.uploadsRoot =
      this.configService.get<string>('UPLOADS_DIR') ?? 'uploads';
  }

  async create(dto: CreateAssetDto, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const fields = this.mapFieldsForStorage(dto.fields ?? []);
    const asset = await this.assetModel.create({
      name: dto.name,
      description: dto.description,
      type: dto.type ?? AssetType.GENERAL,
      tenantId: user.tenantId,
      clientId,
      fields,
      tags: dto.tags ?? [],
    });

    return { asset: this.toResponse(asset) };
  }

  async list(user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const assets = await this.assetModel
      .find({ tenantId: user.tenantId, clientId })
      .sort({ createdAt: -1 })
      .lean<AssetResponseInput[]>();

    return { assets: assets.map((asset) => this.toResponse(asset)) };
  }

  async getCredentials(user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);

    // Fetch all assets for this client
    const assets = await this.assetModel
      .find({ tenantId: user.tenantId, clientId })
      .sort({ createdAt: -1 })
      .lean<AssetResponseInput[]>();

    // Filter for text-only assets (no files)
    const textAssets = assets.filter(
      (asset) => !asset.files || asset.files.length === 0
    );

    // Format credentials response
    const credentials = textAssets.map((asset) => ({
      id: asset.id ?? (asset._id ? asset._id.toString() : ''),
      name: asset.name,
      type: asset.type,
      fields: (asset.fields ?? []).map((field) =>
        this.mapFieldForResponse(field),
      ),
      tags: asset.tags ?? [],
      createdAt: (asset as { createdAt?: Date }).createdAt,
      updatedAt: (asset as { updatedAt?: Date }).updatedAt,
    }));

    return { credentials };
  }

  async getById(id: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const asset = await this.assetModel
      .findOne({ _id: id, tenantId: user.tenantId, clientId })
      .lean<AssetResponseInput>();
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return { asset: this.toResponse(asset) };
  }

  async update(id: string, dto: UpdateAssetDto, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const updatePayload: Record<string, unknown> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.description !== undefined)
      updatePayload.description = dto.description;
    if (dto.type !== undefined) updatePayload.type = dto.type;
    if (dto.tags !== undefined) updatePayload.tags = dto.tags;
    if (dto.fields !== undefined) {
      updatePayload.fields = this.mapFieldsForStorage(dto.fields ?? []);
    }

    const asset = await this.assetModel
      .findOneAndUpdate(
        { _id: id, tenantId: user.tenantId, clientId },
        { $set: updatePayload },
        { new: true },
      )
      .lean<AssetResponseInput>();

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return { asset: this.toResponse(asset) };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const asset = await this.assetModel.findOneAndDelete({
      _id: id,
      tenantId: user.tenantId,
      clientId,
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    await this.removeAssetFiles(asset._id.toString(), user);

    return { deleted: true };
  }

  async addFiles(
    assetId: string,
    files: Express.Multer.File[],
    user: AuthenticatedUser,
  ) {
    if (!files.length) {
      throw new BadRequestException('No files uploaded');
    }

    const clientId = this.requireClientId(user);
    const asset = await this.assetModel.findOne({
      _id: assetId,
      tenantId: user.tenantId,
      clientId,
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
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

    return { asset: this.toResponse(asset) };
  }

  async removeFile(assetId: string, fileId: string, user: AuthenticatedUser) {
    const clientId = this.requireClientId(user);
    const asset = await this.assetModel.findOne({
      _id: assetId,
      tenantId: user.tenantId,
      clientId,
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const file = asset.files.id(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const relativePath = file.relativePath;
    file.deleteOne();
    await asset.save();

    await fs.rm(join(process.cwd(), relativePath), { force: true });

    return { asset: this.toResponse(asset) };
  }

  private requireClientId(user: AuthenticatedUser) {
    if (!user.clientId) {
      throw new BadRequestException('Client scope is required');
    }
    return new Types.ObjectId(user.clientId);
  }

  private mapFieldsForStorage(fields: AssetFieldDto[]) {
    return fields.map((field) => {
      const isSecret = !!field.isSecret;
      const value = field.value ?? '';
      if (isSecret) {
        const encrypted = this.encryptionService.encrypt(value);
        return {
          key: field.key,
          type: field.type ?? AssetFieldType.TEXT,
          isSecret: true,
          encryptedValue: encrypted.cipherText,
          iv: encrypted.iv,
          tag: encrypted.tag,
        };
      }
      return {
        key: field.key,
        type: field.type ?? AssetFieldType.TEXT,
        isSecret: false,
        value,
      };
    });
  }

  private toResponse(asset: AssetResponseInput) {
    const id = asset.id ?? (asset._id ? asset._id.toString() : '');
    const files = (asset.files ?? []) as AssetResponseFile[];
    return {
      id,
      name: asset.name,
      description: asset.description,
      type: asset.type,
      tenantId: asset.tenantId,
      clientId: asset.clientId?.toString?.() ?? asset.clientId,
      tags: asset.tags ?? [],
      fields: (asset.fields ?? []).map((field) =>
        this.mapFieldForResponse(field),
      ),
      files: files.map((file) => ({
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

  private mapFieldForResponse(field: AssetField) {
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

  private async removeAssetFiles(assetId: string, user: AuthenticatedUser) {
    const folderPath = join(
      process.cwd(),
      this.uploadsRoot,
      user.tenantId,
      user.clientId ?? '',
      assetId,
    );

    await fs.rm(folderPath, { recursive: true, force: true });
  }
}
