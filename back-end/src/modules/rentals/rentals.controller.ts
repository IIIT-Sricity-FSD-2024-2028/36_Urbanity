import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import {
  RentalReasonDto,
  OnboardTenantDto,
  RentalReviewDto,
  AssignOwnerDto,
  AmendmentDecisionDto,
  CreateLeaseDto,
  CreateListingDto,
  DepositAdjustmentDto,
  DepositDeductionDecisionDto,
  DepositDisputeResolutionDto,
  DepositEvidenceDto,
  LifecycleDecisionDto,
  PaymentDecisionDto,
  PaymentEvidenceDto,
  RentAmendmentDto,
  RenewalTermsDto,
  UpdateListingDto,
} from './rentals.dto';
import { RentalsService } from './rentals.service';

@UseGuards(RolesGuard)
@ApiTags('rentals')
@ApiBearerAuth('bearerAuth')
@Controller('rentals')
export class RentalsController {
  constructor(private readonly service: RentalsService) {}
  @Post('tenant-onboarding') @Roles(RoleName.CommunityAdmin) onboard(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: OnboardTenantDto,
  ) {
    return apiResponse(this.service.onboardTenant(actor, dto));
  }
  @Get('inventory')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  inventory(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.service.inventory(actor));
  }
  @Post('owner-assignment') @Roles(RoleName.CommunityAdmin) assignOwner(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AssignOwnerDto,
  ) {
    return apiResponse(
      this.service.assignOwner(actor, dto.apartmentId, dto.userId),
    );
  }
  @Post('leases/:id/review') @Roles(RoleName.CommunityAdmin) reviewLease(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RentalReviewDto,
  ) {
    return apiResponse(
      this.service.reviewLease(actor, id, dto.decision, dto.reason),
    );
  }
  @Post('leases/:id/cancel')
  @Roles(RoleName.CommunityAdmin)
  cancelLease(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RentalReasonDto,
  ) {
    return apiResponse(this.service.cancelProposal(actor, id, dto.reason));
  }

  @Get('listings') @Roles(RoleName.CommunityAdmin, RoleName.Resident) listings(
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.availableListings(actor));
  }
  @Get('managed/listings')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  managed(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.service.managed(actor));
  }
  @Get('owned-apartments') @Roles(RoleName.Resident) ownedApartments(
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.ownedApartments(actor));
  }
  @Get('managed/listings/:listingId/tenants')
  @Roles(RoleName.CommunityAdmin)
  tenants(
    @Query('email') email: string | undefined,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.tenantsForListing(actor, listingId, email));
  }
  @Get('managed/leases')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  managedLeases(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.service.managedLeases(actor));
  }
  @Post('listings')
  @Roles(RoleName.CommunityAdmin)
  createListing(
    @Body() dto: CreateListingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.createListing(actor, dto));
  }
  @Patch('listings/:id')
  @Roles(RoleName.CommunityAdmin)
  updateListing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.updateListing(actor, id, dto));
  }
  @Post('leases')
  @Roles(RoleName.CommunityAdmin)
  createLease(
    @Body() dto: CreateLeaseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.createLease(actor, dto));
  }
  @Post('me/leases/:id/accept') @Roles(RoleName.Resident) acceptLease(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.acceptLease(actor, id));
  }
  @Post('managed/leases/:id/activate')
  @Roles(RoleName.CommunityAdmin)
  activateLease(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.activateLease(actor, id));
  }
  @Get('me') @Roles(RoleName.Resident) me(
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.myRentals(actor));
  }
  @Get('me/leases/:id') @Roles(RoleName.Resident) lease(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.myLease(actor, id));
  }
  @Post('me/leases/:id/obligations/:obligationId/payment-evidence')
  @Roles(RoleName.Resident)
  paymentEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('obligationId', ParseUUIDPipe) obligationId: string,
    @Body() dto: PaymentEvidenceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(
      this.service.requestPayment(actor, id, obligationId, dto),
    );
  }
  @Post('payments/:id/verify')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  verifyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.verifyPayment(actor, id));
  }
  @Post('payments/:id/review')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  reviewPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.reviewPayment(actor, id, dto.decision));
  }
  @Post('payments/:id/refunds')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  recordRentRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositAdjustmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.recordPaymentRefund(actor, id, dto));
  }
  @Post('refunds/:id/review') @Roles(RoleName.Resident) reviewRentRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(
      this.service.reviewPaymentRefund(actor, id, dto.decision),
    );
  }
  @Post('me/leases/:id/deposit/evidence')
  @Roles(RoleName.Resident)
  depositEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositEvidenceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.submitDepositEvidence(actor, id, dto));
  }
  @Post('leases/:id/deposit/deductions')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  depositDeduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositAdjustmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(
      this.service.recordDepositAdjustment(actor, id, 'DEDUCTION', dto),
    );
  }
  @Post('leases/:id/deposit/refunds')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  depositRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositAdjustmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(
      this.service.recordDepositAdjustment(actor, id, 'REFUND', dto),
    );
  }
  @Post('deposits/:id/review')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  reviewDeposit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.reviewDeposit(actor, id, dto.decision));
  }
  @Post('deposits/:id/decision')
  @Roles(RoleName.Resident)
  decideDepositDeduction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositDeductionDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.decideDepositDeduction(actor, id, dto));
  }
  @Post('deposits/:id/dispute-resolution')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  resolveDepositDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepositDisputeResolutionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.resolveDepositDispute(actor, id, dto));
  }
  @Post('leases/:id/amendments')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  proposeAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RentAmendmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.proposeAmendment(actor, id, dto));
  }
  @Post('amendments/:id/decision') @Roles(RoleName.Resident) decideAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AmendmentDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.decideAmendment(actor, id, dto.decision));
  }
  @Post('amendments/:id/withdraw')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  withdrawAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.withdrawAmendment(actor, id));
  }
  @Post('me/leases/:id/requests/:type')
  @Roles(RoleName.Resident)
  lifecycleRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: string,
    @Body() dto: RenewalTermsDto | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!['RENEWAL', 'TERMINATION'].includes(type))
      throw new BadRequestException(
        'Request type must be RENEWAL or TERMINATION',
      );
    return apiResponse(
      this.service.requestLifecycle(
        actor,
        id,
        type as 'RENEWAL' | 'TERMINATION',
        dto,
      ),
    );
  }
  @Post('requests/:id/decision')
  @Roles(RoleName.CommunityAdmin, RoleName.Resident)
  decideRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LifecycleDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.decideLifecycle(actor, id, dto.decision));
  }
  @Post('requests/:id/withdraw') @Roles(RoleName.Resident) withdrawRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return apiResponse(this.service.withdrawLifecycle(actor, id));
  }
}
