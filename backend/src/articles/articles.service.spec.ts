import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: Pick<PrismaService, 'article'>;

  beforeEach(() => {
    prisma = {
      article: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as Pick<PrismaService, 'article'>;
    service = new ArticlesService(prisma as PrismaService);
  });

  it('lists only published articles, newest first', async () => {
    await service.listPublished();

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { published: true },
        orderBy: [
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
      }),
    );
  });

  it('does not expose an unpublished article by slug', async () => {
    await expect(service.getPublishedBySlug('draft-article')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.article.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'draft-article', published: true },
      }),
    );
  });
});
