import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { GuestService } from './guest.service';

/** Public, read-only showcase. Never returns student identity or record-level survey/event data. */
@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Get('showcase')
  @Header('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300')
  showcase() {
    return this.guestService.showcase();
  }

  @Get('catalog')
  @Header('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300')
  catalog() {
    return this.guestService.catalog();
  }

  @Get('connect/insights')
  connectInsight() {
    return this.guestService.connectInsight();
  }

  @Get('groups/:id/insights')
  groupConnectInsight(@Param('id') id: string) {
    return this.guestService.connectInsight(id);
  }

  @Get('showcase/analytics')
  @Header('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300')
  showcaseAnalytics() {
    return this.guestService.showcaseAnalytics();
  }

  @Get('student/events/:id')
  async studentEvent(@Param('id') id: string) {
    const event = await this.guestService.studentEvent(id);
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện đã công bố.');
    return event;
  }

  @Get('student/surveys/:id')
  async studentSurvey(@Param('id') id: string) {
    const survey = await this.guestService.studentSurvey(id);
    if (!survey) throw new NotFoundException('Không tìm thấy khảo sát đã công bố.');
    return survey;
  }

  @Get('articles/:id')
  async article(@Param('id') id: string) {
    const article = await this.guestService.article(id);
    if (!article) throw new NotFoundException('Không tìm thấy bài viết đã công bố.');
    return article;
  }

  @Get('groups/:id')
  async group(@Param('id') id: string) {
    const group = await this.guestService.group(id);
    if (!group) throw new NotFoundException('Không tìm thấy cộng đồng.');
    return group;
  }

  @Get('teacher/cycles/:id')
  async teacherCycle(@Param('id') id: string) {
    const cycle = await this.guestService.cycle(id);
    if (!cycle) throw new NotFoundException('Không tìm thấy chu kỳ hoạt động.');
    return cycle;
  }
}
