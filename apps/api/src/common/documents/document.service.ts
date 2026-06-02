import { Injectable, StreamableFile } from '@nestjs/common';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import PDFDocument from 'pdfkit';

/** A renderable document destined for download (memo, letter, report, etc.). */
export interface GeneratedDocument {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/** A simple block model shared by the PDF and DOCX renderers so a caller can
 *  describe a memo/letter once and emit it in either format. */
export interface DocBlock {
  /** Visual weight. `title` is centred + large; `heading` is bold. */
  kind: 'title' | 'heading' | 'paragraph' | 'spacer';
  text?: string;
}

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

/**
 * Central document generation. Modules describe *what* to render (blocks for
 * memos/letters); this service owns *how* (pdfkit / docx). This is the shared
 * foundation the per-module export endpoints (UR-*-export: memos, letters,
 * gazettes, certificates) build on — previously referenced in service comments
 * as the "export-hook framework" but never actually implemented.
 */
@Injectable()
export class DocumentService {
  /** Render blocks to a PDF buffer via pdfkit. */
  async pdf(blocks: DocBlock[], filename: string): Promise<GeneratedDocument> {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 64 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (const b of blocks) {
        switch (b.kind) {
          case 'title':
            doc.fontSize(18).font('Helvetica-Bold').text(b.text ?? '', { align: 'center' });
            doc.moveDown();
            break;
          case 'heading':
            doc.fontSize(13).font('Helvetica-Bold').text(b.text ?? '');
            doc.moveDown(0.3);
            break;
          case 'paragraph':
            doc.fontSize(11).font('Helvetica').text(b.text ?? '', { align: 'left' });
            doc.moveDown(0.5);
            break;
          case 'spacer':
            doc.moveDown();
            break;
        }
      }
      doc.end();
    });
    return { buffer, filename, contentType: MIME.pdf };
  }

  /** Render blocks to a Word (.docx) buffer via the `docx` library. */
  async docx(blocks: DocBlock[], filename: string): Promise<GeneratedDocument> {
    const children = blocks.map((b) => {
      switch (b.kind) {
        case 'title':
          return new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: b.text ?? '', bold: true, size: 36 })],
          });
        case 'heading':
          return new Paragraph({
            children: [new TextRun({ text: b.text ?? '', bold: true, size: 26 })],
          });
        case 'spacer':
          return new Paragraph({ children: [] });
        case 'paragraph':
        default:
          return new Paragraph({
            children: [new TextRun({ text: b.text ?? '', size: 22 })],
          });
      }
    });
    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    return { buffer, filename, contentType: MIME.docx };
  }

  /**
   * Emit blocks in the requested document format. Defaults to PDF. Callers wrap
   * the result with {@link toStream} to return it from a controller.
   */
  render(
    format: 'pdf' | 'docx',
    blocks: DocBlock[],
    filename: string,
  ): Promise<GeneratedDocument> {
    return format === 'docx' ? this.docx(blocks, filename) : this.pdf(blocks, filename);
  }

  /** Wrap a generated document as a NestJS StreamableFile with download headers. */
  toStream(doc: GeneratedDocument): StreamableFile {
    return new StreamableFile(doc.buffer, {
      type: doc.contentType,
      disposition: `attachment; filename="${doc.filename}"`,
    });
  }
}
