import { Injectable } from '@nestjs/common';
import { apiResponse } from './common/api-response';

@Injectable()
export class AppService {
  getHealth() {
    return apiResponse({
      name: 'Urbanity API',
      status: 'running',
    });
  }
}
