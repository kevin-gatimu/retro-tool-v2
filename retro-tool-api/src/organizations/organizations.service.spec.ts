import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { CommonService } from '../common/common.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { ORG_MEMBER_ROLES } from '../common/enums';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let commonService: {
    isSystemAdmin: jest.Mock;
    isOrgOwner: jest.Mock;
    isOrgAdmin: jest.Mock;
  };

  // A member row returned by the "select member" query. Callers override `role`.
  let memberRow: { id: string; role: string };
  const updateReturning = jest.fn();

  beforeEach(async () => {
    memberRow = { id: 'member-row-id', role: ORG_MEMBER_ROLES.Member };
    updateReturning.mockReset().mockResolvedValue([{ id: 'member-row-id' }]);

    // Minimal chainable Drizzle mock: select(...).from().where().limit() resolves
    // to [memberRow]; update().set().where().returning() resolves via the spy.
    const database = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockImplementation(() => Promise.resolve([memberRow])),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: updateReturning,
          }),
        }),
      }),
    };

    commonService = {
      isSystemAdmin: jest.fn().mockResolvedValue(false),
      isOrgOwner: jest.fn().mockResolvedValue(false),
      isOrgAdmin: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: DATABASE_CONNECTION, useValue: database },
        {
          provide: CommonService,
          useValue: {
            getUserFromBetterAuth: jest.fn(),
            ...commonService,
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn(),
            sendNotifications: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateOrganizationMemberRole', () => {
    it('lets an org-admin toggle a member between member and org-admin', async () => {
      commonService.isOrgAdmin.mockResolvedValue(true);
      memberRow.role = ORG_MEMBER_ROLES.Member;

      await expect(
        service.updateOrganizationMemberRole(
          'admin-user',
          'org-1',
          'target-user',
          ORG_MEMBER_ROLES.Admin,
        ),
      ).resolves.toBeDefined();
      expect(updateReturning).toHaveBeenCalled();
    });

    it('forbids an org-admin from changing the owner row', async () => {
      commonService.isOrgAdmin.mockResolvedValue(true);
      memberRow.role = ORG_MEMBER_ROLES.Owner;

      await expect(
        service.updateOrganizationMemberRole(
          'admin-user',
          'org-1',
          'owner-user',
          ORG_MEMBER_ROLES.Member,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(updateReturning).not.toHaveBeenCalled();
    });

    it('lets the owner change the owner row', async () => {
      commonService.isOrgOwner.mockResolvedValue(true);
      memberRow.role = ORG_MEMBER_ROLES.Owner;

      await expect(
        service.updateOrganizationMemberRole(
          'owner-user',
          'org-1',
          'owner-user',
          ORG_MEMBER_ROLES.Admin,
        ),
      ).resolves.toBeDefined();
      expect(updateReturning).toHaveBeenCalled();
    });

    it('forbids a plain member from changing roles', async () => {
      await expect(
        service.updateOrganizationMemberRole(
          'nobody',
          'org-1',
          'target-user',
          ORG_MEMBER_ROLES.Admin,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
