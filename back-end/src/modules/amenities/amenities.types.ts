import { AmenityDto } from './amenities.dto';
export interface Amenity extends AmenityDto {
  id: string;
  communityId: string;
  createdAt: string;
  updatedAt: string;
}
export type BookingStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export interface BookingEvent {
  at: string;
  actorId: string;
  status: BookingStatus;
  reason: string;
}
export interface AmenityBooking {
  originalDurationMinutes: number;
  extensionCharges: ExtensionCharge[];
  version: number;
  clientRequestId?: string;
  changes: BookingChange[];
  id: string;
  amenityId: string;
  amenityName: string;
  communityId: string;
  residentId: string;
  apartmentId: string;
  startsAt: string;
  endsAt: string;
  attendees: number;
  status: BookingStatus;
  createdAt: string;
  feeMinor: number;
  depositMinor: number;
  currency: 'INR';
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'VOIDED';
  paymentHistory: {
    chargeId?: string;
    at: string;
    status: 'NOT_REQUIRED' | 'PENDING' | 'VOIDED';
    reason: string;
  }[];
  history: BookingEvent[];
}
export interface BookingChange {
  extensionDurationMinutes: number;
  extensionFeeMinor: number;
  id: string;
  clientRequestId: string;
  kind: 'EDIT' | 'EXTEND';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  startsAt: string;
  endsAt: string;
  attendees: number;
  createdAt: string;
  decidedAt?: string;
  reason?: string;
}
export interface ExtensionCharge {
  id: string;
  changeId: string;
  amountMinor: number;
  currency: 'INR';
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'VOIDED';
  createdAt: string;
}
export interface MaintenanceBlock {
  id: string;
  amenityId: string;
  communityId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdAt: string;
  createdBy: string;
  releasedAt?: string;
  releasedBy?: string;
}
