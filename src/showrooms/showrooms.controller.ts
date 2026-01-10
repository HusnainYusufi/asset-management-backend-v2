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
import { ShowroomsService } from './showrooms.service';
import { CreateShowroomDto } from './dto/create-showroom.dto';
import { UpdateShowroomDto } from './dto/update-showroom.dto';
import { CreateShowroomAssetDto } from './dto/create-showroom-asset.dto';
import { UpdateShowroomAssetDto } from './dto/update-showroom-asset.dto';
import { ShowroomTemplateDto } from './dto/showroom-meta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const uploadsRoot = process.env.UPLOADS_DIR ?? 'uploads';

@Controller('showrooms')
@UseGuards(JwtAuthGuard)
export class ShowroomsController {
  constructor(private readonly showroomsService: ShowroomsService) {}

  @Post()
  async create(
    @Body() dto: CreateShowroomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.createShowroom(dto, user);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.showroomsService.listShowrooms(user);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.showroomsService.getShowroom(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShowroomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.updateShowroom(id, dto, user);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.removeShowroom(id, user);
  }

  @Post(':id/templates')
  async addTemplate(
    @Param('id') id: string,
    @Body() dto: ShowroomTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.addTemplate(id, dto, user);
  }

  @Patch(':showroomId/templates/:templateId')
  async updateTemplate(
    @Param('showroomId') showroomId: string,
    @Param('templateId') templateId: string,
    @Body() dto: ShowroomTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.updateTemplate(
      showroomId,
      templateId,
      dto,
      user,
    );
  }

  @Delete(':showroomId/templates/:templateId')
  async removeTemplate(
    @Param('showroomId') showroomId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.removeTemplate(showroomId, templateId, user);
  }

  @Post(':showroomId/assets')
  async createAsset(
    @Param('showroomId') showroomId: string,
    @Body() dto: CreateShowroomAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.createAsset(showroomId, dto, user);
  }

  @Get(':showroomId/assets')
  async listAssets(
    @Param('showroomId') showroomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.listAssets(showroomId, user);
  }

  @Get(':showroomId/assets/:assetId')
  async getAsset(
    @Param('showroomId') showroomId: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.getAsset(showroomId, assetId, user);
  }

  @Patch(':showroomId/assets/:assetId')
  async updateAsset(
    @Param('showroomId') showroomId: string,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateShowroomAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.updateAsset(showroomId, assetId, dto, user);
  }

  @Delete(':showroomId/assets/:assetId')
  async removeAsset(
    @Param('showroomId') showroomId: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.removeAsset(showroomId, assetId, user);
  }

  @Post(':showroomId/assets/:assetId/files')
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
          const showroomId = req.params.showroomId;
          const assetId = req.params.assetId;
          const folderPath = join(
            process.cwd(),
            uploadsRoot,
            user.tenantId,
            user.clientId,
            'showrooms',
            showroomId,
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
  async uploadAssetFiles(
    @Param('showroomId') showroomId: string,
    @Param('assetId') assetId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.addAssetFiles(
      showroomId,
      assetId,
      files ?? [],
      user,
    );
  }

  @Delete(':showroomId/assets/:assetId/files/:fileId')
  async removeAssetFile(
    @Param('showroomId') showroomId: string,
    @Param('assetId') assetId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.showroomsService.removeAssetFile(
      showroomId,
      assetId,
      fileId,
      user,
    );
  }
}
