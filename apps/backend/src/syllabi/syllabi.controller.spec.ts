import { Test, TestingModule } from '@nestjs/testing';
import { SyllabiController } from './syllabi.controller';

describe('SyllabiController', () => {
  let controller: SyllabiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyllabiController],
    }).compile();

    controller = module.get<SyllabiController>(SyllabiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
