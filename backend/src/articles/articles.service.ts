import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

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

const managedArticleFields = {
  ...articleFields,
  published: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(authorId: string) {
    return this.prisma.article.findMany({
      where: { authorId },
      select: managedArticleFields,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(dto: CreateArticleDto, authorId: string) {
    const article = await this.prisma.article.create({
      data: {
        authorId,
        category: dto.category.trim(),
        title: dto.title.trim(),
        slug: await this.createUniqueSlug(dto.title),
        description: dto.description.trim(),
        content: dto.content.trim(),
        coverImageUrl: dto.coverImageUrl || null,
        published: true,
        publishedAt: new Date(),
      },
      select: managedArticleFields,
    });
    return article;
  }

  async update(id: string, dto: UpdateArticleDto, authorId: string) {
    const existing = await this.getOwnedArticle(id, authorId);
    return this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.coverImageUrl !== undefined
          ? { coverImageUrl: dto.coverImageUrl || null }
          : {}),
        published: true,
        publishedAt: existing.publishedAt ?? new Date(),
      },
      select: managedArticleFields,
    });
  }

  async setPublished(id: string, authorId: string, published: boolean) {
    await this.getOwnedArticle(id, authorId);
    return this.prisma.article.update({
      where: { id },
      data: {
        published,
        publishedAt: published ? new Date() : null,
      },
      select: managedArticleFields,
    });
  }

  async remove(id: string, authorId: string) {
    await this.getOwnedArticle(id, authorId);
    await this.prisma.article.delete({ where: { id } });
    return { message: 'Đã xóa bài viết' };
  }

  listPublished() {
    return this.prisma.article.findMany({
      where: { published: true },
      select: articleSummaryFields,
      orderBy: [
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
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

  private async getOwnedArticle(id: string, authorId: string) {
    const article = await this.prisma.article.findFirst({
      where: { id, authorId },
      select: { id: true, publishedAt: true },
    });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');
    return article;
  }

  private async createUniqueSlug(title: string) {
    const base =
      title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'bai-viet';
    let slug = base;
    let suffix = 2;
    while (await this.prisma.article.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}
