export interface RentalOccupancyPolicy {
  serviceAccess?(userId: string, apartmentId: string): void;
  resolve(
    userId: string,
    apartmentId?: string,
    startsAt?: string,
    endsAt?: string,
  ): string;
  apartmentChange(apartmentId: string): void;
  userChange(userId: string, nextApartmentId?: string): void;
  ownerAssignment(apartmentId: string, userId?: string): void;
}
export type OccupancyBlocker = (
  apartmentId: string,
  startsAt: string,
  endsAt: string,
) => string | undefined;
