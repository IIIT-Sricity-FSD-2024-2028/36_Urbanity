import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { DEFAULT_COMMUNITY_ADMIN_PASSWORD } from '../registrations/registration.constants';
import { AuthService } from './auth.service';

describe('Authentication of registration accounts', () => {
  const email = 'pending-admin@example.test';
  let users: CrudService<User, Partial<User>, Partial<User>>,
    auth: AuthService,
    jwt: JwtService;
  beforeEach(() => {
    users = new CrudService(new CrudRepository<User>(), 'User');
    jwt = new JwtService({ secret: 'auth-unit-test-secret' });
    auth = new AuthService(users, jwt);
    users.create({
      name: 'Community Admin',
      email,
      role: RoleName.CommunityAdmin,
      communityId: 'community',
      registrationApplicationId: 'registration',
      accountState: 'AWAITING_ACTIVATION',
      passwordHash: hashSync(DEFAULT_COMMUNITY_ADMIN_PASSWORD, 4),
      createdAt: new Date().toISOString(),
    });
  });
  it('explains pending activation only after checking the correct password and issues no token', () => {
    const sign = jest.spyOn(jwt, 'sign');
    expect(() =>
      auth.login({ email, password: DEFAULT_COMMUNITY_ADMIN_PASSWORD }),
    ).toThrow(ForbiddenException);
    expect(() =>
      auth.login({ email, password: DEFAULT_COMMUNITY_ADMIN_PASSWORD }),
    ).toThrow(/retry approval/);
    expect(sign).not.toHaveBeenCalled();
  });
  it('keeps missing accounts and incorrect passwords indistinguishable', () => {
    for (const credentials of [
      { email, password: 'wrong-password' },
      {
        email: 'missing@example.test',
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      },
    ]) {
      expect(() => auth.login(credentials)).toThrow(UnauthorizedException);
      expect(() => auth.login(credentials)).toThrow('Invalid credentials');
    }
  });
  it('allows the default password after activation without returning its hash', () => {
    users.update(users.findAll()[0].id, { accountState: 'ACTIVE' });
    const result = auth.login({
      email,
      password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
    });
    expect(result.user.email).toBe(email);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwt.verify<{ sub: string }>(result.accessToken).sub).toBe(
      result.user.id,
    );
  });
});
