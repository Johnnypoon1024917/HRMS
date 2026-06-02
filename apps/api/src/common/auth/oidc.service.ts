import { BadRequestException, Injectable } from '@nestjs/common';
import { Client, Issuer, generators } from 'openid-client';
import { RegistryPrismaService } from '../prisma/registry-prisma.service';
import { currentTenant } from '../tenancy/tenant-context';

interface IdpConfig {
  type: 'oidc';
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

/**
 * Pluggable OIDC SSO. Per-tenant IdP config (registry `tenant.idp`) with an
 * env-level fallback so SaaS can offer a shared IdP and on-prem can point at
 * the customer's identity provider — no code change. SAML/LDAP adapters slot
 * in behind the same controller using this shape.
 */
@Injectable()
export class OidcService {
  private readonly clients = new Map<string, Client>();

  constructor(private readonly registry: RegistryPrismaService) {}

  private redirectUri() {
    const base = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    return `${base}/api/auth/oidc/callback`;
  }

  private async configForCurrentTenant(): Promise<IdpConfig> {
    const { tenantId } = currentTenant();
    const t = await this.registry.tenant.findUnique({ where: { id: tenantId } });
    const cfg = (t?.idp as IdpConfig | null) ?? this.envConfig();
    if (!cfg) throw new BadRequestException('SSO is not configured for this tenant');
    return cfg;
  }

  private envConfig(): IdpConfig | null {
    if (!process.env.OIDC_ISSUER) return null;
    return {
      type: 'oidc',
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
      scopes: ['openid', 'email', 'profile'],
    };
  }

  private async clientForCurrentTenant(): Promise<{
    client: Client;
    scopes: string[];
  }> {
    const { slug } = currentTenant();
    const cfg = await this.configForCurrentTenant();
    let client = this.clients.get(slug);
    if (!client) {
      const issuer = await Issuer.discover(cfg.issuer);
      client = new issuer.Client({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uris: [this.redirectUri()],
        response_types: ['code'],
      });
      this.clients.set(slug, client);
    }
    return { client, scopes: cfg.scopes ?? ['openid', 'email', 'profile'] };
  }

  /** Build the IdP authorization URL + the PKCE verifier to stash in the tx. */
  async authorization() {
    const { client, scopes } = await this.clientForCurrentTenant();
    const codeVerifier = generators.codeVerifier();
    const state = generators.state();
    const url = client.authorizationUrl({
      scope: scopes.join(' '),
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
    });
    return { url, codeVerifier, state };
  }

  /** Exchange the code, returning normalised claims for AuthService. */
  async callback(
    query: Record<string, string>,
    codeVerifier: string,
    state: string,
  ) {
    const { client } = await this.clientForCurrentTenant();
    const tokenSet = await client.callback(this.redirectUri(), query, {
      code_verifier: codeVerifier,
      state,
    });
    const ui = await client.userinfo(tokenSet);
    if (!ui.sub || !ui.email) {
      throw new BadRequestException('IdP did not return sub/email');
    }
    return {
      sub: ui.sub,
      email: ui.email as string,
      name: (ui.name as string) ?? undefined,
    };
  }
}
