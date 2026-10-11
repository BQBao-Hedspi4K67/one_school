import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitResponseDto } from './submit-response.dto';

describe('SubmitResponseDto', () => {
  it('allows answer values while rejecting other unknown answer properties', async () => {
    const dto = plainToInstance(SubmitResponseDto, {
      answers: [{ questionId: 'question-1', value: ['option-1'], extra: true }],
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].children?.[0].children?.[0].constraints).toHaveProperty(
      'whitelistValidation',
    );
    expect(errors[0].children?.[0].children?.[0].property).toBe('extra');
  });

  it('accepts arbitrary answer values', async () => {
    const dto = plainToInstance(SubmitResponseDto, {
      answers: [{ questionId: 'question-1', value: ['option-1', 2] }],
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });
});
