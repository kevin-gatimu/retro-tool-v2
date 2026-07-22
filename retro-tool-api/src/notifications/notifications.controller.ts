import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard, Session } from '@thallesp/nestjs-better-auth';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import type { SessionUser } from '../common/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  pushSubscribeSchema,
  PushSubscribeDto,
  PushSubscribeDtoClass,
} from './dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications for the current user (max 50, newest first)',
  })
  @ApiResponse({ status: 200, description: 'Notification list' })
  getNotifications(@Session() session: SessionUser) {
    return this.notificationsService.getNotifications(session.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  getUnreadCount(@Session() session: SessionUser) {
    return this.notificationsService.getUnreadCount(session.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  markAllAsRead(@Session() session: SessionUser) {
    return this.notificationsService.markAllAsRead(session.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  markAsRead(
    @Session() session: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(session.user.id, id);
  }

  @Get('push-vapid-key')
  @ApiOperation({ summary: 'Get the VAPID public key for push subscriptions' })
  @ApiResponse({ status: 200, description: '{ publicKey: string | null }' })
  getVapidPublicKey() {
    return {
      publicKey: this.configService.get<string>('VAPID_PUBLIC_KEY') ?? null,
    };
  }

  @Post('push-subscribe')
  @ApiOperation({ summary: 'Save a browser push subscription' })
  @ApiBody({ type: PushSubscribeDtoClass })
  @ApiResponse({ status: 201, description: '{ success: true }' })
  @UsePipes(new ZodValidationPipe(pushSubscribeSchema))
  pushSubscribe(
    @Session() session: SessionUser,
    @Body() body: PushSubscribeDto,
  ) {
    return this.pushService.subscribe(session.user.id, body);
  }

  @Delete('push-subscribe')
  @ApiOperation({ summary: 'Remove browser push subscription' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  pushUnsubscribe(@Session() session: SessionUser) {
    return this.pushService.unsubscribe(session.user.id);
  }
}
