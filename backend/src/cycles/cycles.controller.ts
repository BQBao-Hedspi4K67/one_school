import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CyclesService } from './cycles.service';

@Controller('cycles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Post()
  create(@Body() dto: CreateCycleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cycles.create(dto, user);
  }
}
