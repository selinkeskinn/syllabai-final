import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments')
@Controller('enrollments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'List all enrollments (instructor only)' })
  findAll() {
    return this.enrollmentsService.findAll();
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get current user enrollments' })
  findMine(@Request() req: any) {
    return this.enrollmentsService.findByUser(req.user.userId);
  }
}