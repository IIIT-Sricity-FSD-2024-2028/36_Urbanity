import { Injectable } from '@nestjs/common';
import { SEEDED_DEPARTMENTS, SEEDED_USERS } from '../../data/store';

@Injectable()
export class DashboardService {
  getSummary() {
    return {
      departments: SEEDED_DEPARTMENTS.length,
      users: SEEDED_USERS.length,
      activeUsers: SEEDED_USERS.filter((user) => user.status === 'Active')
        .length,
      openComplaints: 0,
    };
  }
}
