import { validate } from 'class-validator';
import { DashboardQueryDto } from './dashboard-query.dto';

describe('DashboardQueryDto', () => {
  it.each(['BASELINE', 'EFFECTIVENESS', 'OVERVIEW'])(
    'accepts analysis kind %s',
    async (kind) => {
      const query = Object.assign(new DashboardQueryDto(), { kind });

      await expect(
        validate(query, { whitelist: true, forbidNonWhitelisted: true }),
      ).resolves.toHaveLength(0);
    },
  );

  it('rejects unsupported analysis kinds', async () => {
    const query = Object.assign(new DashboardQueryDto(), {
      kind: 'INVALID',
    });

    const errors = await validate(query, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });
});
