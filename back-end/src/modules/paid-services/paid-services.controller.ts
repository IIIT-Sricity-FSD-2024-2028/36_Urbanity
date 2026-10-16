import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AssignServiceWorkerDto, CompleteServiceDto, CreateCatalogueDto, CreateServiceRequestDto, DecideEstimateDto, ReportServicePaymentDto, ReviewFinalCostDto, ReviewServiceDto, ScheduleServiceDto, SubmitEstimateDto, UpdateCatalogueDto, VerifyServicePaymentDto, VersionDto } from './paid-services.dto';
import { PaidServicesService } from './paid-services.service';
import { PaidServiceEvidenceService } from './paid-service-evidence.service';
import { ServiceProgressDto } from './paid-services.dto';

@ApiTags('paid services')
@ApiBearerAuth('bearerAuth')
@UseGuards(RolesGuard)
@Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker)
@Controller('paid-services')
export class PaidServicesController {
  constructor(private readonly service: PaidServicesService, private readonly files: PaidServiceEvidenceService) {}
  @Get('catalogue') catalogue(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.listCatalogue(actor)); }
  @Post('catalogue') @Roles(RoleName.CommunityAdmin)
  createCatalogue(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCatalogueDto) { return apiResponse(this.service.createCatalogue(actor, dto)); }
  @Patch('catalogue/:id') @Roles(RoleName.CommunityAdmin)
  updateCatalogue(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCatalogueDto) { return apiResponse(this.service.updateCatalogue(actor, id, dto)); }
  @Get('requests') list(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.list(actor)); }
  @Post('requests') @Roles(RoleName.Resident)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateServiceRequestDto) { return apiResponse(this.service.createRequest(actor, dto)); }
  @Get('requests/:id') get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return apiResponse(this.service.get(actor, id)); }
  @Get('requests/:id/eligible-workers') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  workers(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) { return apiResponse(this.service.eligibleWorkers(actor, id)); }
  @Post('requests/:id/assign') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  assign(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignServiceWorkerDto) { return apiResponse(this.service.assign(actor, id, dto)); }
  @Post('requests/:id/estimates') @Roles(RoleName.MaintenanceWorker)
  estimate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitEstimateDto) { return apiResponse(this.service.submitEstimate(actor, id, dto)); }
  @Post('requests/:id/estimate-decision') @Roles(RoleName.Resident)
  decision(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideEstimateDto) { return apiResponse(this.service.decideEstimate(actor, id, dto)); }
  @Post('requests/:id/schedule') @Roles(RoleName.Resident, RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  schedule(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleServiceDto) { return apiResponse(this.service.schedule(actor, id, dto)); }
  @Post('requests/:id/start') @Roles(RoleName.MaintenanceWorker)
  start(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) { return apiResponse(this.service.start(actor, id, dto.version)); }
  @Post('requests/:id/complete') @Roles(RoleName.MaintenanceWorker)
  complete(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteServiceDto) { return apiResponse(this.service.complete(actor, id, dto)); }
  @Post('requests/:id/progress') @Roles(RoleName.MaintenanceWorker)
  progress(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ServiceProgressDto) { return apiResponse(this.service.progress(actor, id, dto.version, dto.note)); }
  @Post('requests/:id/final-cost-review') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  finalCost(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewFinalCostDto) { return apiResponse(this.service.reviewFinalCost(actor, id, dto)); }
  @Post('requests/:id/payment-approval') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  paymentApproval(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) { return apiResponse(this.service.approvePayment(actor, id, dto.version)); }
  @Post('requests/:id/payment-report') @Roles(RoleName.Resident)
  report(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportServicePaymentDto) { return apiResponse(this.service.reportPayment(actor, id, dto)); }
  @Post('requests/:id/payment-verification') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  verify(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifyServicePaymentDto) { return apiResponse(this.service.verifyPayment(actor, id, dto)); }
  @Post('requests/:id/payment-receipt') @Roles(RoleName.MaintenanceWorker)
  receipt(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) { return apiResponse(this.service.confirmReceipt(actor, id, dto.version)); }
  @Post('requests/:id/review') @Roles(RoleName.Resident)
  review(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewServiceDto) { return apiResponse(this.service.review(actor, id, dto)); }
  @Post('requests/:id/cancel') @Roles(RoleName.Resident, RoleName.CommunityAdmin, RoleName.TowerRepresentative)
  cancel(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionDto) { return apiResponse(this.service.cancel(actor, id, dto.version)); }
  @Post('requests/:id/evidence') @Roles(RoleName.Resident)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) { return apiResponse(this.files.upload(actor, id, file)); }
  @Get('requests/:id/evidence/:evidenceId')
  evidence(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Param('evidenceId', ParseUUIDPipe) evidenceId: string, @Res() response: Response) {
    const { content, mimeType } = this.files.read(actor, id, evidenceId);
    response.type(mimeType).send(content);
  }
}
