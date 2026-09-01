import { Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AttachmentsService, MAX_IMAGE_SIZE_BYTES } from './attachments.service';

@ApiTags('complaint attachments')
@ApiBearerAuth('bearerAuth')
@UseGuards(RolesGuard)
@Controller('complaints/:complaintId/attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}
  @Post() @Roles(RoleName.Resident, RoleName.MaintenanceWorker)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data') @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  upload(@Param('complaintId', ParseUUIDPipe) complaintId: string, @UploadedFile() file: any, @CurrentUser() user: AuthenticatedUser) { return { success: true, data: this.service.upload(complaintId, file, user) }; }
  @Get() @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker)
  list(@Param('complaintId', ParseUUIDPipe) complaintId: string, @CurrentUser() user: AuthenticatedUser) { return { success: true, data: this.service.list(complaintId, user) }; }
  @Get(':attachmentId') @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker)
  retrieve(@Param('complaintId', ParseUUIDPipe) complaintId: string, @Param('attachmentId', ParseUUIDPipe) attachmentId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) { const { attachment, content } = this.service.read(complaintId, attachmentId, user); response.type(attachment.mimeType).send(content); }
}
