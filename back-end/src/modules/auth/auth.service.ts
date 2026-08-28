import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { CrudService } from '../../common/crud/crud.service';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import { LoginDto } from './dto/login.dto';
import { AuthenticationResult } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(serviceToken('users'))
    private readonly usersService: CrudService<
      User,
      Partial<User>,
      Partial<User>
    >,
    private readonly jwtService: JwtService,
  ) {}

  login(loginDto: LoginDto): AuthenticationResult {
    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const user = this.usersService
      .findAll()
      .find((item) => item.email.toLowerCase() === normalizedEmail);

    if (!user || !compareSync(loginDto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash: _passwordHash, ...authenticatedUser } = user;
    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        role: user.role,
        email: user.email,
      }),
      user: authenticatedUser,
    };
  }
}
