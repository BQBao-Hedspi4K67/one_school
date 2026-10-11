import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const articleFields = {
  id: true,
  category: true,
  title: true,
  slug: true,
  description: true,
  content: true,
  coverImageUrl: true,
  publishedAt: true,
} as const;

const articleSummaryFields = {
  id: true,
  category: true,
  title: true,
  slug: true,
  description: true,
  coverImageUrl: true,
  publishedAt: true,
} as const;

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished() {
    return this.prisma.article.findMany({
      where: { published: true },
      select: articleSummaryFields,
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
  }

  async getPublishedBySlug(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: { slug, published: true },
      select: articleFields,
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');
    return article;
  }
}