import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let createdArticleData: Record<string, unknown>;
  let updatedArticleData: Record<string, unknown>;
  let prisma: {
    article: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    createdArticleData = {};
    updatedArticleData = {};
    prisma = {
      article: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) => {
            createdArticleData = args.data;
            return Promise.resolve({ id: 'article-1' });
          }),
        update: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) => {
            updatedArticleData = args.data;
            return Promise.resolve({ id: 'article-1' });
          }),
        delete: jest.fn().mockResolvedValue({ id: 'article-1' }),
      },
    };
    service = new ArticlesService(prisma as unknown as PrismaService);
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

  it('creates and publishes a teacher-owned article with a normalized slug', async () => {
    await service.create(
      {
        category: ' Giáo dục ',
        title: 'Ứng dụng AI trong lớp học',
        description: ' Mô tả ',
        content: ' Nội dung ',
      },
      'teacher-1',
    );

    expect(createdArticleData).toMatchObject({
      authorId: 'teacher-1',
      category: 'Giáo dục',
      title: 'Ứng dụng AI trong lớp học',
      slug: 'ung-dung-ai-trong-lop-hoc',
      published: true,
    });
  });

  it('keeps edited articles published and preserves their first publication date', async () => {
    const publishedAt = new Date('2026-10-01T00:00:00.000Z');
    prisma.article.findFirst.mockResolvedValue({
      id: 'article-1',
      publishedAt,
    });

    await service.update('article-1', { title: 'Tiêu đề mới' }, 'teacher-1');

    expect(updatedArticleData).toMatchObject({
      title: 'Tiêu đề mới',
      published: true,
      publishedAt,
    });
  });

  it('prevents editing an article not owned by the teacher', async () => {
    await expect(
      service.update('article-1', { title: 'Sửa tiêu đề' }, 'teacher-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.article.update).not.toHaveBeenCalled();
  });
});
