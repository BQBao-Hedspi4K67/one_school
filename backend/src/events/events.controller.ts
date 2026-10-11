import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RegistrationStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateEventDto } from './dto/create-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { EventsService } from './events.service';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: EventQueryDto) {
    return this.events.list(user, query);
  }

  @Get('mine')
  @Roles(UserRole.STUDENT)
  myActivities(@CurrentUser() user: AuthenticatedUser) {
    return this.events.listStudentActivities(user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.getById(id, user);
  }

  @Post()
  @Roles(UserRole.TEACHER)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.events.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.remove(id, user);
  }

  @Post(':id/publish')
  @Roles(UserRole.TEACHER)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.publish(id, user);
  }

  @Post(':id/join')
  @Roles(UserRole.STUDENT)
  join(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.join(id, user);
  }

  @Patch(':id/participants/:studentId')
  @Roles(UserRole.TEACHER)
  updateRegistration(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateRegistrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (dto.status === RegistrationStatus.REQUESTED) {
      throw new BadRequestException('Trạng thái đăng ký không hợp lệ');
    }
    return this.events.updateRegistration(id, studentId, dto.status, user);
  }
}
