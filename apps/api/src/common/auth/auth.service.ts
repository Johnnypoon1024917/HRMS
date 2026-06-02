import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { currentTenant } from '../tenancy/tenant-context';
import { effectivePostsFor } from '../rbac/rbac.service';

export interface JwtUser {
  sub: string;
  tenant: string;
  /** Posts the user currently holds; one is "active" and drives data scope. */
  posts: string[];
  activePost?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tp: TenantPrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Password login (SaaS). On-prem/SSO deployments swap this for an
   * OIDC/SAML/LDAP strategy that maps idpSubject -> AppUser (slot reserved
   * to satisfy CSD REQ-SEC-002 "DPP single sign-on").
   */
  async login(email: string, password: string) {
    const db = this.tp.forCurrentTenant();
    const user = await db.appUser.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const posts = await effectivePostsFor(db, user.id);
    return this.issue({
      sub: user.id,
      tenant: currentTenant().slug,
      posts,
      activePost: posts[0],
    });
  }

  /**
   * SSO sign-in: maps verified IdP claims to an AppUser. Just-in-time
   * provisioning creates the user on first login (linked by idpSubject);
   * existing users are matched by idpSubject then email. The IdP — not this
   * service — owns authentication (CSD REQ-SEC-002 "DPP single sign-on").
   */
  async loginWithClaims(claims: {
    sub: string;
    email: string;
    name?: string;
  }) {
    const db = this.tp.forCurrentTenant();
    let user =
      (await db.appUser.findFirst({ where: { idpSubject: claims.sub } })) ??
      (await db.appUser.findUnique({ where: { email: claims.email } }));

    if (!user) {
      user = await db.appUser.create({
        data: {
          email: claims.email,
          displayName: claims.name ?? claims.email,
          idpSubject: claims.sub,
        },
      });
    } else if (!user.idpSubject) {
      // Link an existing (e.g. seeded) account to the IdP on first SSO.
      user = await db.appUser.update({
        where: { id: user.id },
        data: { idpSubject: claims.sub },
      });
    }

    const posts = await effectivePostsFor(db, user.id);
    return this.issue({
      sub: user.id,
      tenant: currentTenant().slug,
      posts,
      activePost: posts[0],
    });
  }

  /** Multi-post users may switch which post is active (REQ-SEC-002). */
  async switchPost(user: JwtUser, postId: string) {
    if (!user.posts.includes(postId)) {
      throw new UnauthorizedException('Post not held by user');
    }
    return this.issue({ ...user, activePost: postId });
  }

  private issue(payload: JwtUser) {
    return { accessToken: this.jwt.sign(payload), user: payload };
  }
}
