import { User } from '../../../data/schemas';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: User['role'];
}

export type AuthenticationResponseUser = Omit<User, 'passwordHash'>;

export interface AuthenticationResult {
  accessToken: string;
  user: AuthenticationResponseUser;
}
