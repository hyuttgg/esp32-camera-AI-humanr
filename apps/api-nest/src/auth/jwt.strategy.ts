import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => {
          let token = null;
          if (request && request.cookies) {
            token = request.cookies['session_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_jwt_key_minimum_32_characters_random',
    });
  }

  async validate(payload: any) {
    const user = this.db.mockUsers.get(payload.email) || this.db.mockUsers.get(payload.username);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account inactive or session revoked');
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles,
    };
  }
}

