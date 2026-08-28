import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleName } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { ComplaintType } from '../complaints/complaints.dto';
import { ComplaintsService } from '../complaints/complaints.service';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class ReportsService {
  constructor(private readonly dashboard: DashboardService, private readonly complaints: ComplaintsService) {}
  getOverview(actor: AuthenticatedUser) {
    if (![RoleName.SuperAdmin, RoleName.CommunityAdmin].includes(actor.role)) throw new ForbiddenException('Only Super Admins and Community Admins may view reports');
    const summary = this.dashboard.getSummary(actor);
    const complaints = this.complaints.findAllForActor(actor);
    return {
      generatedAt: new Date().toISOString(),
      ...summary,
      requiredWorkTypes: this.countBy(complaints, (complaint) => complaint.requiredWorkType),
      complaintTypes: this.countBy(complaints, (complaint) => complaint.type, Object.values(ComplaintType)),
    };
  }
  private countBy<T>(items: T[], key: (item: T) => string, expected: string[] = []) {
    const counts: Record<string, number> = Object.fromEntries(expected.map((value) => [value, 0]));
    for (const item of items) {
      const value = key(item);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }
}
