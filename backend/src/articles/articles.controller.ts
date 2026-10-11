import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ArticlesService } from './articles.service';

@Controller('articles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list() {
    return this.articles.listPublished();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.articles.getPublishedBySlug(slug);
  }
}