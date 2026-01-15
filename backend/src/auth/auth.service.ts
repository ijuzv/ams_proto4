import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '@prisma/client';

export interface UserPayload {
  id: number;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async login(user: User, rememberMe: boolean = false) {
    const payload = {
      sub: user.id.toString(), // JWT standard uses 'sub' (subject) for user ID
      email: user.email,
      role: user.role,
    };

    // Set token expiration based on rememberMe
    // 30 days for rememberMe, 1 hour for temporary sessions
    const expiresIn = rememberMe ? '30d' : '1h';

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
      },
      access_token: this.jwtService.sign(payload, { expiresIn }),
    };
  }

  async register(name: string, email: string, password: string, role?: string, managerId?: number, avatar?: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Registering user with hashed password:', { name, email, hashedPassword, role, managerId, avatar });
    console.log('Hashed password:', hashedPassword);
    return this.usersService.create({
      name,
      email,
      password: hashedPassword,
      role: role as UserRole || UserRole.USER,
      managerId,
      avatar,
    });
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }
}
