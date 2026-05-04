import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CrudService } from '../../common/crud/crud.service';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(serviceToken('users'))
    private readonly usersService: CrudService<
      User,
      Partial<User>,
      Partial<User>
    >,
  ) {}

  login(loginDto: LoginDto): AuthenticatedUser {
    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const user = this.usersService.findAll().find((item) => {
      return (
        item.email.toLowerCase() === normalizedEmail &&
        item.passwordHash === loginDto.password &&
        item.roleId === loginDto.roleId
      );
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _passwordHash, ...authenticatedUser } = user;
    return authenticatedUser;
  }
}
