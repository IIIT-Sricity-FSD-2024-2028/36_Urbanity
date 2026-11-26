import { User } from '../../../data/schemas';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: User['role'];
  platformPaymentRequired?: true;
}

export type AuthenticationResponseUser = Omit<User, 'passwordHash'> & Pick<AuthenticatedUser, 'platformPaymentRequired'>;

export interface AuthenticationResult {
  accessToken: string;
  user: AuthenticationResponseUser;
}
