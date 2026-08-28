import { Request } from 'express';
import { AuthenticatedUser } from './auth.interface';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
