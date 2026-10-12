import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser, JwtPayload } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

export function toAuthUser(payload: JwtPayload): AuthUser {
  return { userId: payload.sub, role: payload.role, trainerId: payload.tid ?? null, studentId: payload.sid ?? null };
}

/** Guard global: exige Bearer token válido, exceto em rotas @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Token de acesso ausente');
    }
    try {
      request.user = toAuthUser(await this.jwt.verifyAsync<JwtPayload>(token));
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Token inválido ou expirado');
    }
    return true;
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : null;
  }
}
