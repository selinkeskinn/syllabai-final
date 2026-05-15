import { Test, TestingModule } from '@nestjs/testing';
import { SyllabiService } from './syllabi.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResourcesService } from '../resources/resources.service';

describe('SyllabiService', () => {
  let service: SyllabiService;

  const prismaMock = {
    syllabus: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    syllabusWeek: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    syllabusVersion: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
    enrollment: {
      findMany: jest.fn(),
    },
  };

  const notificationsServiceMock = {
    create: jest.fn(),
  };

  const resourcesServiceMock = {
    uploadAndIndex: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyllabiService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationsService, useValue: notificationsServiceMock },
        { provide: ResourcesService, useValue: resourcesServiceMock },
      ],
    }).compile();

    service = module.get<SyllabiService>(SyllabiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
