import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { MemberRole } from '@workspace/types';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../types/authenticated-user.interface';

interface JwtPayload {
  sub: string;
  familyId: string | null;
  role: MemberRole | null;
}

function fromCookie(req: Request): string | null {
  return (req.cookies as Record<string, string | undefined>)?.['c4t_token'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        fromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      passReqToCallback: false,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { userId: payload.sub, familyId: payload.familyId, role: payload.role };
  }
}
