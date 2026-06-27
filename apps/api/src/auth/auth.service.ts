import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MemberRole } from '@workspace/types';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimPasswordDto } from './dto/claim-password.dto';
import { CreateChildDto } from './dto/create-child.dto';
import { SignupDto } from './dto/signup.dto';
import type { AuthenticatedUser } from './types/authenticated-user.interface';

const INVITE_TTL_HOURS = 72;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ── Token helpers ──────────────────────────────────────────────────────────

  issueToken(userId: string, familyId: string | null, role: MemberRole | null): string {
    return this.jwt.sign({ sub: userId, familyId, role });
  }

  private pickActiveMembership(memberships: Array<{ familyId: string; role: MemberRole }>) {
    return memberships[0] ?? null;
  }

  // ── Flow 1: Parent email/password signup ───────────────────────────────────

  async signupParent(dto: SignupDto): Promise<{ access_token: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const { user, membership } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, displayName: dto.displayName, claimedAt: new Date() },
      });
      await tx.credential.create({ data: { userId: user.id, passwordHash } });
      const family = await tx.family.create({ data: { name: dto.familyName } });
      const membership = await tx.familyMembership.create({
        data: { userId: user.id, familyId: family.id, role: MemberRole.PARENT },
      });
      return { user, membership };
    });

    return { access_token: this.issueToken(user.id, membership.familyId, MemberRole.PARENT) };
  }

  // ── Flow 1: Parent email/password login ────────────────────────────────────

  async validateLocalUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credential: true, memberships: true },
    });
    if (!user?.credential) return null;

    const match = await bcrypt.compare(password, user.credential.passwordHash);
    if (!match) return null;

    const m = this.pickActiveMembership(user.memberships);
    return { userId: user.id, familyId: m?.familyId ?? null, role: m?.role ?? null };
  }

  loginWithToken(user: AuthenticatedUser): { access_token: string } {
    return { access_token: this.issueToken(user.userId, user.familyId, user.role) };
  }

  // ── Flow 1: Google login / signup for parents ──────────────────────────────

  async loginWithGoogle(
    googleSub: string,
    email: string | undefined,
    displayName: string,
  ): Promise<AuthenticatedUser> {
    const existing = await this.prisma.federatedIdentity.findUnique({
      where: { provider_providerSub: { provider: 'google', providerSub: googleSub } },
      include: { user: { include: { memberships: true } } },
    });

    if (existing) {
      const m = this.pickActiveMembership(existing.user.memberships);
      return { userId: existing.userId, familyId: m?.familyId ?? null, role: m?.role ?? null };
    }

    // New user via Google — create user + federated identity (no family yet)
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, displayName, claimedAt: new Date() },
      });
      await tx.federatedIdentity.create({
        data: { userId: u.id, provider: 'google', providerSub: googleSub },
      });
      return u;
    });

    return { userId: user.id, familyId: null, role: null };
  }

  // ── Flow 2: Parent creates child account + invite ──────────────────────────

  async createChild(
    parentUser: AuthenticatedUser,
    familyId: string,
    dto: CreateChildDto,
  ): Promise<{ inviteToken: string }> {
    if (parentUser.familyId !== familyId) {
      throw new ForbiddenException('You are not a member of this family');
    }
    if (parentUser.role !== MemberRole.PARENT) {
      throw new ForbiddenException('Only a parent can create child accounts');
    }

    if (dto.email) {
      const emailTaken = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (emailTaken) throw new ConflictException('An account with this email already exists');
    }

    const { rawToken } = await this.prisma.$transaction(async (tx) => {
      const child = await tx.user.create({
        data: { email: dto.email, displayName: dto.displayName },
        // claimedAt is null → account is unclaimed
      });
      await tx.familyMembership.create({
        data: { userId: child.id, familyId, role: MemberRole.CHILD },
      });

      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

      await tx.inviteToken.create({
        data: { userId: child.id, familyId, tokenHash, expiresAt },
      });

      return { rawToken };
    });

    return { inviteToken: rawToken };
  }

  // ── Flow 3: Child looks up invite ─────────────────────────────────────────

  async peekInvite(rawToken: string) {
    const record = await this.resolveInvite(rawToken);
    return {
      childName: record.user.displayName,
      familyName: record.family.name,
      expiresAt: record.expiresAt,
    };
  }

  // ── Flow 3: Child claims account with password ─────────────────────────────

  async claimWithPassword(dto: ClaimPasswordDto): Promise<{ access_token: string }> {
    const record = await this.resolveInvite(dto.token);

    const existingCredential = await this.prisma.credential.findUnique({
      where: { userId: record.userId },
    });
    if (existingCredential) {
      throw new BadRequestException('This account already has a password set');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.credential.create({ data: { userId: record.userId, passwordHash } });
      await tx.user.update({
        where: { id: record.userId },
        data: { claimedAt: new Date() },
      });
      await tx.inviteToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
    });

    return {
      access_token: this.issueToken(record.userId, record.familyId, MemberRole.CHILD),
    };
  }

  // ── Flow 3: Child claims account with Google ───────────────────────────────
  // SECURITY: this is only reachable via /auth/claim/google/callback where
  // the state parameter carries the invite token. The parent cannot reach this
  // code path on behalf of the child — they would need the unconsumed invite token.

  async claimWithGoogle(
    rawToken: string,
    googleSub: string,
    email: string | undefined,
  ): Promise<AuthenticatedUser> {
    const record = await this.resolveInvite(rawToken);

    const alreadyLinked = await this.prisma.federatedIdentity.findUnique({
      where: { provider_providerSub: { provider: 'google', providerSub: googleSub } },
    });
    if (alreadyLinked) throw new ConflictException('This Google account is already linked');

    await this.prisma.$transaction(async (tx) => {
      await tx.federatedIdentity.create({
        data: { userId: record.userId, provider: 'google', providerSub: googleSub },
      });
      await tx.user.update({
        where: { id: record.userId },
        data: { claimedAt: new Date(), email: email ?? undefined },
      });
      await tx.inviteToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
    });

    return { userId: record.userId, familyId: record.familyId, role: MemberRole.CHILD };
  }

  // ── Shared invite resolution ───────────────────────────────────────────────

  private async resolveInvite(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.inviteToken.findUnique({
      where: { tokenHash },
      include: { user: true, family: true },
    });

    if (!record) throw new NotFoundException('Invite not found');
    if (record.consumedAt) throw new GoneException('This invite has already been used');
    if (record.expiresAt < new Date()) throw new GoneException('This invite has expired');

    return record;
  }

  // ── Current user profile ──────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { family: true } },
        federatedIdentities: { select: { provider: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
