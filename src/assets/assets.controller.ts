import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import type { Request } from 'express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const uploadsRoot = process.env.UPLOADS_DIR ?? 'uploads';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  async create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.create(dto, user);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.list(user);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assetsService.getById(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.update(id, dto, user);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.remove(id, user);
  }

  @Post(':id/files')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { files: 20, fileSize: 20 * 1024 * 1024 },
      storage: diskStorage({
        destination: (
          req: Request & { user?: AuthenticatedUser },
          _file,
          cb,
        ) => {
          const user = req.user;
          if (!user?.tenantId || !user?.clientId) {
            return cb(new BadRequestException('Client scope is required'), '');
          }
          const assetId = req.params.id;
          const folderPath = join(
            process.cwd(),
            uploadsRoot,
            user.tenantId,
            user.clientId,
            assetId,
          );
          mkdirSync(folderPath, { recursive: true });
          cb(null, folderPath);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
    }),
  )
  async uploadFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.addFiles(id, files ?? [], user);
  }

  @Delete(':assetId/files/:fileId')
  async removeFile(
    @Param('assetId') assetId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assetsService.removeFile(assetId, fileId, user);
  }
}
