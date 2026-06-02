import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { OidcService } from './oidc.service';
import { JwtGuard } from './jwt.guard';
import { currentTenant } from '../tenancy/tenant-context';

const TX_COOKIE = 'oidc_tx';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oidc: OidcService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @UseGuards(JwtGuard)
  @Post('switch-post')
  switchPost(@Req() req: any, @Body() body: { postId: string }) {
    return this.auth.switchPost(req.user, body.postId);
  }

  // ---- SSO (OIDC) ----

  /** Kick off SSO: stash PKCE verifier+state in a short-lived signed cookie,
   *  then redirect the browser to the tenant's IdP. */
  @Get('oidc/login')
  async oidcLogin(@Res() res: Response) {
    const { url, codeVerifier, state } = await this.oidc.authorization();
    const tx = this.jwt.sign(
      { codeVerifier, state },
      { expiresIn: '10m' },
    );
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600_000,
    };
    res.cookie(TX_COOKIE, tx, cookieOpts);
    // Lets the callback (a fresh request from the IdP, no X-Tenant header)
    // resolve the tenant.
    res.cookie('tenant_hint', currentTenant().slug, {
      ...cookieOpts,
      httpOnly: false,
    });
    res.redirect(url);
  }

  /** IdP redirect target: validate the tx, exchange the code, issue our JWT,
   *  hand control back to the SPA with the token. */
  @Get('oidc/callback')
  async oidcCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, string>,
  ) {
    const raw = this.parseCookie(req.headers.cookie, TX_COOKIE);
    const webUrl = process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000';
    try {
      const { codeVerifier, state } = this.jwt.verify<{
        codeVerifier: string;
        state: string;
      }>(raw ?? '');
      const claims = await this.oidc.callback(query, codeVerifier, state);
      const { accessToken } = await this.auth.loginWithClaims(claims);
      res.clearCookie(TX_COOKIE);
      // Hand the token to the SPA callback page (consumed then stored).
      res.redirect(`${webUrl}/auth/callback#token=${accessToken}`);
    } catch {
      res.redirect(`${webUrl}/login?sso=failed`);
    }
  }

  private parseCookie(header: string | undefined, name: string) {
    return header
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  }
}
