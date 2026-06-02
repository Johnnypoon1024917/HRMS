import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { LicenseClaims } from '@hrms/contracts';

/**
 * Issues and verifies signed license keys (RS256 JWT) for on-prem
 * entitlement. SaaS uses `Subscription.status`; on-prem uses these keys —
 * the enforcement check is identical (`tenant_module.enabled`).
 *
 * Key material:
 *   - LICENSE_PRIVATE_KEY (PEM) — operator side, signs new licenses.
 *   - LICENSE_PUBLIC_KEY  (PEM) — embedded in every on-prem build, verifies.
 * In dev, an ephemeral key pair is generated so flows work end-to-end.
 */
@Injectable()
export class LicenseService {
  private readonly log = new Logger(LicenseService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor() {
    let priv = process.env.LICENSE_PRIVATE_KEY;
    let pub = process.env.LICENSE_PUBLIC_KEY;
    if (!priv || !pub) {
      const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      priv = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
      pub = kp.publicKey.export({ type: 'spki', format: 'pem' }) as string;
      this.log.warn(
        'LICENSE_PRIVATE_KEY/PUBLIC_KEY not set — using an EPHEMERAL key pair. ' +
          'Licenses signed here will be invalid after restart. Set these in production.',
      );
    }
    this.privateKey = priv;
    this.publicKey = pub;
  }

  sign(claims: Omit<LicenseClaims, 'issuedAt'>): string {
    const payload: LicenseClaims = {
      ...claims,
      issuedAt: new Date().toISOString(),
    };
    return jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256',
      expiresIn: Math.max(
        1,
        Math.floor((new Date(claims.expiresAt).getTime() - Date.now()) / 1000),
      ),
    });
  }

  verify(token: string): LicenseClaims {
    return jwt.verify(token, this.publicKey, {
      algorithms: ['RS256'],
    }) as LicenseClaims;
  }
}
