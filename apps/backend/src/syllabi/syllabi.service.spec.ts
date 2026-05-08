import { Test, TestingModule } from '@nestjs/testing';
import { SyllabiService } from './syllabi.service';

describe('SyllabiService', () => {
  let service: SyllabiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SyllabiService],
    }).compile();

    service = module.get<SyllabiService>(SyllabiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
