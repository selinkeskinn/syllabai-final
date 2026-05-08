import { Test, TestingModule } from '@nestjs/testing';
import { SyllabiController } from './syllabi.controller';
import { SyllabiService } from './syllabi.service';

describe('SyllabiController', () => {
  let controller: SyllabiController;

  const syllabiServiceMock = {
    findAll: jest.fn(),
    findByCourseId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    uploadDocument: jest.fn(),
    update: jest.fn(),
    getVersions: jest.fn(),
    findWeeks: jest.fn(),
    createWeek: jest.fn(),
    updateWeek: jest.fn(),
    deleteWeek: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyllabiController],
      providers: [
        {
          provide: SyllabiService,
          useValue: syllabiServiceMock,
        },
      ],
    }).compile();

    controller = module.get<SyllabiController>(SyllabiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
