import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';
import { currentTenant } from '../../../common/tenancy/tenant-context';

/**
 * Bank file generator. Two adapters in-tree:
 *   - iso20022_pain001  → SEPA / SWIFT credit transfer XML (used by most
 *                          European + Asia-Pacific banks for B2B payroll).
 *   - hsbc_csv          → Hong Kong HSBC autopay-in CSV (common local format).
 * Both produce inline payloads; large tenants can swap to S3 by replacing
 * the `payload` field with a presigned `fileKey`.
 */
@Injectable()
export class BankFileService {
  constructor(private readonly tp: TenantPrismaService) {}

  async generate(runId: string, format: string, userId: string) {
    const db = this.tp.forCurrentTenant();
    const run = await db.payRun.findUnique({
      where: { id: runId },
      include: {
        payslips: true,
        payGroup: true,
      },
    });
    if (!run) throw new NotFoundException('Pay run');

    const staffIds = run.payslips.map((p) => p.staffId);
    const accounts = await db.bankAccount.findMany({
      where: { staffId: { in: staffIds } },
    });
    const acctByStaff = new Map(accounts.map((a) => [a.staffId, a]));

    const items = run.payslips.map((p) => ({
      staffId: p.staffId,
      net: Number(p.net),
      account: acctByStaff.get(p.staffId),
    }));

    const totalAmount = items.reduce((a, i) => a + i.net, 0);
    let payload = '';
    if (format === 'iso20022_pain001') {
      payload = renderPain001({
        tenantSlug: currentTenant().slug,
        runId: run.id,
        period: run.period,
        currency: run.payGroup.currency,
        paymentDate: run.paymentDate ?? new Date(),
        items,
      });
    } else if (format === 'hsbc_csv') {
      payload = renderHsbcCsv(items, run.payGroup.currency);
    } else {
      throw new NotFoundException(`Bank format ${format}`);
    }

    const fileKey = `pay/${run.id}/${format}-${Date.now()}.${
      format === 'iso20022_pain001' ? 'xml' : 'csv'
    }`;
    return db.payExport.create({
      data: {
        payRunId: run.id,
        format,
        fileKey,
        payload,
        totalAmount,
        itemCount: items.length,
        generatedBy: userId,
      },
    });
  }

  async list(runId: string) {
    return this.tp.forCurrentTenant().payExport.findMany({
      where: { payRunId: runId },
      orderBy: { generatedAt: 'desc' },
    });
  }
}

function renderPain001(opts: {
  tenantSlug: string;
  runId: string;
  period: string;
  currency: string;
  paymentDate: Date;
  items: Array<{ staffId: string; net: number; account?: any }>;
}): string {
  const msgId = `${opts.tenantSlug.toUpperCase()}-${opts.runId.slice(0, 8)}`;
  const total = opts.items.reduce((a, i) => a + i.net, 0).toFixed(2);
  const exec = opts.paymentDate.toISOString().slice(0, 10);
  const created = new Date().toISOString();
  const tx = opts.items
    .map((it, idx) => {
      const acct = it.account?.accountNoEnc ?? 'UNCONFIGURED';
      const name = it.account?.holderName ?? it.staffId;
      const bank = it.account?.bankCode ?? '000';
      return `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${msgId}-${idx + 1}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${opts.currency}">${it.net.toFixed(2)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BICFI>${bank}</BICFI></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${escapeXml(name)}</Nm></Cdtr>
        <CdtrAcct><Id><Othr><Id>${escapeXml(acct)}</Id></Othr></Id></CdtrAcct>
        <RmtInf><Ustrd>Payroll ${opts.period}</Ustrd></RmtInf>
      </CdtTrfTxInf>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${created}</CreDtTm>
      <NbOfTxs>${opts.items.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <InitgPty><Nm>${escapeXml(opts.tenantSlug)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-PMT</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt><Dt>${exec}</Dt></ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(opts.tenantSlug)}</Nm></Dbtr>
      <DbtrAcct><Id><Othr><Id>${opts.tenantSlug}-PAYROLL</Id></Othr></Id></DbtrAcct>
${tx}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

function renderHsbcCsv(
  items: Array<{ staffId: string; net: number; account?: any }>,
  currency: string,
) {
  const header = 'BankCode,AccountNo,HolderName,Amount,Currency,Reference';
  const rows = items.map((it) => {
    const bank = it.account?.bankCode ?? '000';
    const acct = it.account?.accountNoEnc ?? '';
    const name = (it.account?.holderName ?? it.staffId).replace(/,/g, ' ');
    return `${bank},${acct},${name},${it.net.toFixed(2)},${currency},PAYROLL`;
  });
  return [header, ...rows].join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  );
}
