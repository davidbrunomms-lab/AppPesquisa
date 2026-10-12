import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AssessmentStatus } from '@prisma/client';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { AssessmentsService } from '../application/assessments.service';
import {
  CompareQuery,
  CreateAssessmentDto,
  PhotoQuery,
  ScheduleAssessmentDto,
  UpdateAssessmentDto,
} from './assessments.dto';

@ApiTags('Avaliação física')
@ApiBearerAuth()
@Roles('TRAINER', 'STUDENT')
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: AssessmentStatus })
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('studentId') studentId?: string, @Query('status') status?: AssessmentStatus) {
    return this.assessments.list(user, studentId, status);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssessmentDto) {
    return this.assessments.create(user, dto);
  }

  @Roles('TRAINER')
  @Post('schedule')
  schedule(@CurrentUser() user: AuthUser, @Body() dto: ScheduleAssessmentDto) {
    return this.assessments.schedule(user.trainerId!, dto);
  }

  /** Comparação ANTES x DEPOIS. */
  @Get('compare')
  compare(@CurrentUser() user: AuthUser, @Query() q: CompareQuery) {
    return this.assessments.compare(user, q.before, q.after);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssessmentDto) {
    return this.assessments.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.remove(user, id);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  photo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PhotoQuery,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.assessments.uploadPhoto(user, id, q.angle, file);
  }
}
