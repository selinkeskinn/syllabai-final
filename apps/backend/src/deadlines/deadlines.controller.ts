import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DeadlinesService } from './deadlines.service';
import { CreateDeadlineDto } from './create-deadline.dto';
import { UpdateDeadlineDto } from './update-deadline.dto';

@ApiTags('Deadlines')
@Controller('deadlines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Get()
  @ApiOperation({ summary: 'Get deadlines (role-aware: student sees enrolled, instructor sees own courses)' })
  @ApiQuery({ name: 'courseId', required: false })
  findAll(@Request() req: any, @Query('courseId') courseId?: string) {
    if (req.user.role === 'INSTRUCTOR') {
      return this.deadlinesService.findForInstructor(req.user.userId, courseId);
    }
    return this.deadlinesService.findForStudent(req.user.userId, courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deadline by ID' })
  findOne(@Param('id') id: string) {
    return this.deadlinesService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Create a deadline (instructor only)' })
  create(@Body() body: CreateDeadlineDto, @Request() req: any) {
    return this.deadlinesService.create(body, req.user.userId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Update a deadline (instructor only)' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateDeadlineDto,
    @Request() req: any,
  ) {
    return this.deadlinesService.update(id, body, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('INSTRUCTOR')
  @ApiOperation({ summary: 'Delete a deadline (instructor only)' })
  delete(@Param('id') id: string, @Request() req: any) {
    return this.deadlinesService.delete(id, req.user.userId);
  }
}
