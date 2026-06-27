import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ClaimPasswordDto } from './dto/claim-password.dto';
import { CreateChildDto } from './dto/create-child.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { GoogleAuthGuard, GoogleClaimAuthGuard } from './guards/google-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { AuthenticatedUser } from './types/authenticated-user.interface';

const COOKIE_NAME = 'c4t_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Helper: issue token + set cookie ─────────────────────────────────────

  private issueWithCookie(user: AuthenticatedUser, res: Response) {
    const result = this.authService.loginWithToken(user);
    res.cookie(COOKIE_NAME, result.access_token, COOKIE_OPTIONS);
    return result;
  }

  // ── Parent signup (email + password, creates family) ──────────────────────

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signupParent(dto);
    res.cookie(COOKIE_NAME, result.access_token, COOKIE_OPTIONS);
    return result;
  }

  // ── Parent login (email + password) ───────────────────────────────────────

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  login(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() _dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.issueWithCookie(req.user, res);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  // ── Current user profile ──────────────────────────────────────────────────

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }

  // ── Google OAuth: parent login / signup ──────────────────────────────────

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin() {
    // Passport redirects to Google — no body needed
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  googleCallback(
    @Req() req: Request & { user: AuthenticatedUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.issueWithCookie(req.user, res);
  }

  // ── Parent creates child account + invite ────────────────────────────────

  @Post('families/:familyId/children')
  createChild(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: CreateChildDto,
  ) {
    return this.authService.createChild(user, familyId, dto);
  }

  // ── Invite peek (public — child opens the link to see whose account it is) ─

  @Public()
  @Get('invite/:token')
  peekInvite(@Param('token') token: string) {
    return this.authService.peekInvite(token);
  }

  // ── Child claims with password ────────────────────────────────────────────

  @Public()
  @Post('claim/password')
  async claimWithPassword(
    @Body() dto: ClaimPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.claimWithPassword(dto);
    res.cookie(COOKIE_NAME, result.access_token, COOKIE_OPTIONS);
    return result;
  }

  // ── Child claims with Google OAuth ───────────────────────────────────────

  @Public()
  @Get('claim/google')
  @Redirect()
  async startGoogleClaim(@Query('token') token: string) {
    if (!token) throw new BadRequestException('token query param is required');
    await this.authService.peekInvite(token);

    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const callbackUrl = encodeURIComponent(
      process.env.GOOGLE_CLAIM_CALLBACK_URL ?? 'http://localhost:8000/auth/claim/google/callback',
    );
    const scope = encodeURIComponent('email profile');
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${callbackUrl}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(token)}`;

    return { url };
  }

  @Public()
  @UseGuards(GoogleClaimAuthGuard)
  @Get('claim/google/callback')
  googleClaimCallback(
    @Req() req: Request & { user: AuthenticatedUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.issueWithCookie(req.user, res);
  }
}
