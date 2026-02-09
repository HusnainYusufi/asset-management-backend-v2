import {
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest {
  user: {
    userId: string;
    tenantId: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const notifications = await this.notificationsService.findAllForUser(
      req.user.tenantId,
      req.user.userId,
    );
    return {
      statusCode: 200,
      data: notifications.map((n) => ({
        id: n._id?.toString(),
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        assetName: n.assetName,
        showroomName: n.showroomName,
        daysUntilExpiry: n.daysUntilExpiry,
        createdAt: (n as unknown as { createdAt: Date }).createdAt,
      })),
    };
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    const count = await this.notificationsService.getUnreadCount(
      req.user.tenantId,
      req.user.userId,
    );
    return {
      statusCode: 200,
      data: { count },
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const notification = await this.notificationsService.markAsRead(id);
    if (!notification) {
      return {
        statusCode: 404,
        message: 'Notification not found',
      };
    }
    return {
      statusCode: 200,
      message: 'Notification marked as read',
    };
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    await this.notificationsService.markAllAsRead(
      req.user.tenantId,
      req.user.userId,
    );
    return {
      statusCode: 200,
      message: 'All notifications marked as read',
    };
  }
}
