import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { addDays } from '@personalpro/shared';
import { AppConfig } from '../../../config/app-config';
import { AuditService } from '../../../common/audit/audit.service';
import type { JwtPayload } from '../../../common/auth/auth-user';
import { sha256 } from '../../../common/crypto/encryption.service';
import { ConflictError, DomainError, UnauthorizedError } from '../../../common/errors/domain-errors';
import { randomToken } from '../../../common/utils/random';
import { MailPort } from '../../../infrastructure/mail/mail.port';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { InvitesService } from '../../invites/application/invites.service';
import { SubscriptionsService } from '../../subscriptions/application/subscriptions.service';
import { assertStrongPassword, normalizeEmail } from '../domain/password-policy';
import { ChangePasswordDto, RegisterDto, SocialLoginDto } from '../presentation/dto/auth.dto';
import { SocialTokenVerifier } from './social-token.verifier';

export const PRIVACY_POLICY_VERSION = '2026-10';
const BCRYPT_ROUNDS = 12;

type UserWithProfiles = User & { trainer: { id: string } | null; student: { id: string } | null };

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly mail: MailPort,
    private readonly audit: AuditService,
    private readonly invites: InvitesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly social: SocialTokenVerifier,
  ) {}

  // -------------------------------------------------------------------------
  // Cadastro e login
  // -------------------------------------------------------------------------

  async register(dto: RegisterDto, meta: RequestMeta) {
    assertStrongPassword(dto.password);
    const email = normalizeEmail(dto.email);
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictError('Já existe uma conta com este e-mail');
    }
    if (dto.role === 'STUDENT' && dto.inviteCode) await this.invites.preview(dto.inviteCode); // valida antes de criar

    const user = await this.createAccount({
      email,
      name: dto.name.trim(),
      phone: dto.phone,
      role: dto.role,
      passwordHash: await hash(dto.password, BCRYPT_ROUNDS),
      cref: dto.cref,
      marketingOptIn: dto.marketingOptIn ?? false,
    });
    const linkError = await this.tryAcceptInvite(user, dto.inviteCode);
    await this.audit.log({ userId: user.id, action: 'auth.register', ip: meta.ip });
    return { ...(await this.issueTokens(user, meta)), linkError };
  }

  async login(emailRaw: string, password: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(emailRaw) },
      include: { trainer: { select: { id: true } }, student: { select: { id: true } } },
    });
    // Mesmo erro para e-mail inexistente e senha errada (evita enumeração de contas)
    if (!user || user.deletedAt || !user.passwordHash || !(await compare(password, user.passwordHash))) {
      await this.audit.log({ userId: user?.id, action: 'auth.login_failed', ip: meta.ip });
      throw new UnauthorizedError('E-mail ou senha inválidos');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ userId: user.id, action: 'auth.login', ip: meta.ip });
    return this.issueTokens(user, meta);
  }

  async socialLogin(dto: SocialLoginDto, meta: RequestMeta) {
    const profile = await this.social.verify(dto.provider, dto.idToken);
    const include = { trainer: { select: { id: true } }, student: { select: { id: true } } };

    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId } },
      include: { user: { include } },
    });
    let user: UserWithProfiles | null = identity?.user ?? null;

    if (!user && profile.email && profile.emailVerified) {
      // Conta existente com o mesmo e-mail verificado: vincula o provedor
      user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(profile.email) }, include });
      if (user) {
        await this.prisma.authIdentity.create({
          data: { userId: user.id, provider: profile.provider, providerUserId: profile.providerUserId },
        });
      }
    }

    let isNewUser = false;
    let linkError: string | null = null;
    if (!user) {
      if (!dto.role) {
        // O app pergunta o perfil (aluno/professor) e repete a chamada
        throw new DomainError('Primeiro acesso: informe se você é aluno ou professor', 'ROLE_REQUIRED');
      }
      if (dto.acceptTerms !== true) {
        throw new DomainError('É necessário aceitar os termos de uso e a política de privacidade', 'TERMS_REQUIRED');
      }
      if (!profile.email) throw new DomainError('O provedor não retornou um e-mail', 'EMAIL_REQUIRED');
      user = await this.createAccount({
        email: normalizeEmail(profile.email),
        name: dto.name?.trim() || profile.name || profile.email.split('@')[0],
        role: dto.role,
        avatarUrl: profile.picture,
        emailVerified: profile.emailVerified,
        identity: { provider: profile.provider, providerUserId: profile.providerUserId },
      });
      linkError = await this.tryAcceptInvite(user, dto.inviteCode);
      isNewUser = true;
    }
    if (user.deletedAt) throw new UnauthorizedError('Conta desativada');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ userId: user.id, action: `auth.social_login.${profile.provider.toLowerCase()}`, ip: meta.ip });
    return { ...(await this.issueTokens(user, meta)), isNewUser, linkError };
  }

  private async createAccount(input: {
    email: string;
    name: string;
    role: 'STUDENT' | 'TRAINER';
    phone?: string;
    passwordHash?: string;
    cref?: string;
    avatarUrl?: string;
    marketingOptIn?: boolean;
    emailVerified?: boolean;
    identity?: { provider: Prisma.AuthIdentityCreateWithoutUserInput['provider']; providerUserId: string };
  }): Promise<UserWithProfiles> {
    const inviteCode = input.role === 'TRAINER' ? await this.invites.uniqueTrainerCode() : null;
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        role: input.role,
        avatarUrl: input.avatarUrl,
        passwordHash: input.passwordHash,
        marketingOptIn: input.marketingOptIn ?? false,
        emailVerifiedAt: input.emailVerified ? new Date() : null,
        termsAcceptedAt: new Date(),
        privacyVersion: PRIVACY_POLICY_VERSION,
        trainer: inviteCode ? { create: { inviteCode, cref: input.cref } } : undefined,
        student: input.role === 'STUDENT' ? { create: {} } : undefined,
        identities: input.identity ? { create: input.identity } : undefined,
      },
      include: { trainer: { select: { id: true } }, student: { select: { id: true } } },
    });
    if (user.trainer) await this.subscriptions.startTrial(user.trainer.id);
    return user;
  }

  private async tryAcceptInvite(user: UserWithProfiles, code?: string): Promise<string | null> {
    if (!code || !user.student) return null;
    try {
      await this.invites.accept(user.student.id, code);
      return null;
    } catch (error) {
      // A conta foi criada; o aluno pode informar o código novamente depois
      return (error as Error).message;
    }
  }

  // -------------------------------------------------------------------------
  // Tokens
  // -------------------------------------------------------------------------

  async issueTokens(user: UserWithProfiles, meta: RequestMeta = {}) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      tid: user.trainer?.id,
      sid: user.student?.id,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomToken(48);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        userAgent: meta.userAgent?.slice(0, 255),
        expiresAt: addDays(new Date(), this.config.jwt.refreshTtlDays),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  /** Rotação de refresh token com detecção de reuso (revoga todas as sessões). */
  async refresh(refreshToken: string, meta: RequestMeta) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { include: { trainer: { select: { id: true } }, student: { select: { id: true } } } } },
    });
    if (!stored) throw new UnauthorizedError('Sessão inválida');
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ userId: stored.userId, action: 'auth.refresh_reuse_detected', ip: meta.ip });
      throw new UnauthorizedError('Sessão inválida');
    }
    if (stored.expiresAt < new Date() || stored.user.deletedAt) throw new UnauthorizedError('Sessão expirada');
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.user, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Senha
  // -------------------------------------------------------------------------

  /** Sempre responde sucesso (não revela se o e-mail existe). */
  async forgotPassword(emailRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(emailRaw) } });
    if (!user || user.deletedAt) return;
    const token = await this.createPasswordToken(user.id, 1 / 24);
    await this.mail.send({
      to: user.email,
      subject: 'Redefinição de senha — PersonalPro',
      text:
        `Olá, ${user.name.split(' ')[0]}!\n\nPara criar uma nova senha acesse:\n` +
        `${this.config.appUrl}/redefinir-senha?token=${token}\n\nO link expira em 1 hora. ` +
        'Se você não solicitou, ignore este e-mail.',
    });
  }

  /** Token de definição de senha (também usado no cadastro manual de alunos pelo professor). */
  async createPasswordToken(userId: string, validDays: number): Promise<string> {
    const token = randomToken(32);
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + validDays * 86_400_000) },
    });
    return token;
  }

  async resetPassword(token: string, password: string) {
    assertStrongPassword(password);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new DomainError('Link de redefinição inválido ou expirado', 'INVALID_TOKEN');
    }
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: await hash(password, BCRYPT_ROUNDS), emailVerifiedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ userId: stored.userId, action: 'auth.password_reset' });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    assertStrongPassword(dto.newPassword);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash && !(dto.currentPassword && (await compare(dto.currentPassword, user.passwordHash)))) {
      throw new UnauthorizedError('Senha atual incorreta');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(dto.newPassword, BCRYPT_ROUNDS) } });
    await this.audit.log({ userId, action: 'auth.password_changed' });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { trainer: { select: { id: true } }, student: { select: { id: true } } },
    });
    return this.toPublicUser(user);
  }

  toPublicUser(user: UserWithProfiles) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role as UserRole,
      trainerId: user.trainer?.id ?? null,
      studentId: user.student?.id ?? null,
      hasPassword: Boolean(user.passwordHash),
      createdAt: user.createdAt,
    };
  }
}
