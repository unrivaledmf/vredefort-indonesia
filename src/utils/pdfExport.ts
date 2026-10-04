import katex from 'katex';
import { Note, Folder } from '../types.ts';

interface ExportPdfOptions {
  note: Note;
  folderName?: string;
  acaraName?: string;
  logoUrl?: string | null;
  siteName?: string;
  academicYear?: string;
}

// Convert markdown to print-ready HTML with KaTeX formulas
export function generatePrintableNoteHtml({
  note,
  folderName = 'Umum',
  acaraName,
  logoUrl,
  siteName = 'VREDEFORT INDONESIA',
  academicYear = '2026/2027'
}: ExportPdfOptions): string {
  // Parse markdown content to clean HTML with KaTeX
  let bodyHtml = note.content || '';

  // 1. Math block $$...$$
  bodyHtml = bodyHtml.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false
      });
      return `<div class="math-block">${rendered}</div>`;
    } catch {
      return `<div class="math-block">${math}</div>`;
    }
  });

  // 2. Inline math $...$
  bodyHtml = bodyHtml.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
    try {
      const rendered = katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false
      });
      return `<span class="math-inline">${rendered}</span>`;
    } catch {
      return `<code>${math}</code>`;
    }
  });

  // 3. Images ![alt](url)
  bodyHtml = bodyHtml.replace(/!\[(.*?)\]\((.*?)\)/g, (_match, alt, url) => {
    return `
      <figure class="note-image">
        <img src="${url}" alt="${alt}" />
        ${alt ? `<figcaption>${alt}</figcaption>` : ''}
      </figure>
    `;
  });

  // 4. Headings
  bodyHtml = bodyHtml.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  bodyHtml = bodyHtml.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  bodyHtml = bodyHtml.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 5. Bold & Italic
  bodyHtml = bodyHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  bodyHtml = bodyHtml.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 6. Callout boxes > [!NOTE] or > [!INFO]
  bodyHtml = bodyHtml.replace(
    /^> \[!(NOTE|INFO|TIP|WARNING|IMPORTANT)\]\s*(.*(?:\n>.*)*)/gim,
    (_match, type, content) => {
      const cleanContent = content.replace(/^>\s?/gm, '').trim();
      const badgeClass = type.toLowerCase();
      return `
        <div class="callout-box ${badgeClass}">
          <div class="callout-title">${type.toUpperCase()}</div>
          <div class="callout-body">${cleanContent}</div>
        </div>
      `;
    }
  );

  // 7. Checklists - [ ] and - [x]
  bodyHtml = bodyHtml.replace(/^- \[ \] (.*$)/gim, '<div class="check-item"><span class="box">☐</span> $1</div>');
  bodyHtml = bodyHtml.replace(/^- \[x\] (.*$)/gim, '<div class="check-item checked"><span class="box">☑</span> $1</div>');

  // 8. Line breaks
  bodyHtml = bodyHtml.replace(/\n\n/g, '</p><p>');
  bodyHtml = `<p>${bodyHtml}</p>`;

  const createdDate = new Date(note.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const updatedDate = new Date(note.updatedAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${note.title} - ${siteName}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.6;
      font-size: 13px;
      margin: 0;
      padding: 0;
    }
    
    /* Official Header */
    .document-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-branding {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .header-logo-fallback {
      width: 44px;
      height: 44px;
      background: #059669;
      color: white;
      font-weight: 800;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .header-title-text {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      color: #111827;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .header-subtitle {
      font-size: 11px;
      color: #059669;
      font-weight: 600;
      margin: 2px 0 0 0;
      text-transform: uppercase;
    }
    .header-academic {
      text-align: right;
      font-size: 11px;
      color: #4b5563;
    }
    .header-academic strong {
      display: block;
      color: #111827;
      font-size: 12px;
    }

    /* Document Title & Meta */
    .doc-title-section {
      margin-bottom: 18px;
    }
    .doc-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 10px 0;
      line-height: 1.3;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 11px;
    }
    .meta-table td {
      padding: 6px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .meta-table tr:last-child td {
      border-bottom: none;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
      width: 15%;
    }
    .meta-val {
      color: #1e293b;
      font-weight: 600;
    }

    /* Body Content */
    .doc-body {
      font-size: 13px;
      color: #334155;
    }
    h1 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 24px;
    }
    h2 {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 18px;
    }
    h3 {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 14px;
    }
    p {
      margin: 8px 0;
    }

    /* Equations */
    .math-block {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #059669;
      padding: 12px 16px;
      margin: 14px 0;
      border-radius: 6px;
      text-align: center;
      overflow-x: auto;
      font-size: 14px;
    }
    .math-inline {
      padding: 1px 4px;
      background: #f1f5f9;
      border-radius: 3px;
    }

    /* Images */
    .note-image {
      margin: 16px 0;
      text-align: center;
    }
    .note-image img {
      max-width: 100%;
      max-height: 380px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
    }
    .note-image figcaption {
      font-size: 11px;
      color: #64748b;
      font-style: italic;
      margin-top: 6px;
    }

    /* Callouts */
    .callout-box {
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0284c7;
      background: #f0f9ff;
      border-radius: 6px;
      padding: 10px 14px;
      margin: 12px 0;
    }
    .callout-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0369a1;
      margin-bottom: 4px;
    }
    .callout-body {
      font-size: 12px;
      color: #1e293b;
    }

    /* Checklists */
    .check-item {
      font-size: 12px;
      margin: 4px 0;
    }
    .check-item .box {
      font-family: monospace;
      margin-right: 6px;
      font-size: 14px;
    }
    .check-item.checked {
      color: #64748b;
      text-decoration: line-through;
    }

    /* Footer */
    .document-footer {
      margin-top: 35px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- Official Letterhead -->
  <div class="document-header">
    <div class="header-branding">
      ${
        logoUrl
          ? `<img src="${logoUrl}" alt="${siteName}" class="header-logo" />`
          : `<div class="header-logo-fallback">V</div>`
      }
      <div>
        <h1 class="header-title-text">${siteName}</h1>
        <div class="header-subtitle">Laboratorium &amp; Perencanaan Tambang Mineral</div>
      </div>
    </div>
    <div class="header-academic">
      <strong>Tahun Akademik ${academicYear}</strong>
      <span>Dokumen Teknis &amp; Rekayasa</span>
    </div>
  </div>

  <!-- Document Meta Table -->
  <div class="doc-title-section">
    <h1 class="doc-title">${note.title}</h1>
    <table class="meta-table">
      <tr>
        <td class="meta-label">Folder / Kategori:</td>
        <td class="meta-val">${folderName}</td>
        <td class="meta-label">Acara Terkait:</td>
        <td class="meta-val">${acaraName || '-'}</td>
      </tr>
      <tr>
        <td class="meta-label">Penulis / Author:</td>
        <td class="meta-val">${note.createdBy || 'Tim Rekayasa'}</td>
        <td class="meta-label">Tanggal Terbit:</td>
        <td class="meta-val">${createdDate} (Diperbarui: ${updatedDate})</td>
      </tr>
      ${
        note.tags && note.tags.length > 0
          ? `
      <tr>
        <td class="meta-label">Kata Kunci (Tags):</td>
        <td colspan="3" class="meta-val">${note.tags.join(', ')}</td>
      </tr>`
          : ''
      }
    </table>
  </div>

  <!-- Note Body -->
  <div class="doc-body">
    ${bodyHtml}
  </div>

  <!-- Document Footer -->
  <div class="document-footer">
    <div>Dicetak secara otomatis dari Workspace ${siteName} · Rahasia untuk kalangan internal</div>
    <div>Halaman 1</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

// Helper to trigger print window
export function exportNoteToPdf(options: ExportPdfOptions) {
  const html = generatePrintableNoteHtml(options);
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
