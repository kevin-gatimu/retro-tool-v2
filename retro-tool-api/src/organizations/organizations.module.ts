import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { OrgInvitationsController } from './invitations/invitations.controller';
import { OrgInvitationsService } from './invitations/invitations.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, CommonModule, NotificationsModule, EmailModule],
  controllers: [OrganizationsController, OrgInvitationsController],
  providers: [OrganizationsService, OrgInvitationsService],
  exports: [OrganizationsService, OrgInvitationsService],
})
export class OrganizationsModule {}
