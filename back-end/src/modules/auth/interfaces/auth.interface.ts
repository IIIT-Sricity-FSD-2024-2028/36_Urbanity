import { User } from '../../../data/schemas';

export type AuthenticatedUser = Omit<User, 'passwordHash'>;
