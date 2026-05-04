import { Injectable } from '@nestjs/common';
import { SEEDED_DEPARTMENTS, SEEDED_USERS } from '../../data/store';

@Injectable()
export class ReportsService {
  getOverview() {
    return {
      generatedAt: new Date().toISOString(),
      departments: SEEDED_DEPARTMENTS,
      usersByRole: SEEDED_USERS.reduce<Record<string, number>>((acc, user) => {
        acc[user.roleId] = (acc[user.roleId] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }
}
