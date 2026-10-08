import { Test, TestingModule } from '@nestjs/testing';
import { ViewingsController } from './viewings.controller';

describe('ViewingsController', () => {
  let controller: ViewingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViewingsController],
    }).compile();

    controller = module.get<ViewingsController>(ViewingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
