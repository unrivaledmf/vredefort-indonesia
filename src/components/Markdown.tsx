import React, { useState } from 'react';
import katex from 'katex';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  ExternalLink,
  Maximize2
} from 'lucide-react';

interface MarkdownProps {
  content: string;
  className?: string;
  onToggleChecklist?: (itemText: string, newChecked: boolean) => void;
}

// Convert common LaTeX math constructs to clean Unicode text (fallback)
export function convertLatexToUnicode(latex: string): string {
  if (!latex) return '';

  let res = latex.trim();
  res = res.replace(/\\(?:text|mathrm|mathbf)\{([^}]+)\}/g, '$1');
  res = res.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
  res = res.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  res = res.replace(/\\sqrt\s*([a-zA-Z0-9]+)/g, '√$1');

  const greekMap: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\Gamma': 'Γ',
    '\\delta': 'δ', '\\Delta': 'Δ', '\\epsilon': 'ε', '\\varepsilon': 'ε',
    '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\Theta': 'Θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\Lambda': 'Λ',
    '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\Xi': 'Ξ',
    '\\pi': 'π', '\\Pi': 'Π', '\\rho': 'ρ', '\\sigma': 'σ',
    '\\Sigma': 'Σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\Phi': 'Φ', '\\chi': 'χ', '\\psi': 'ψ', '\\Psi': 'Ψ',
    '\\omega': 'ω', '\\Omega': 'Ω'
  };

  for (const [k, v] of Object.entries(greekMap)) {
    res = res.split(k).join(v);
  }

  const symMap: Record<string, string> = {
    '\\times': '×', '\\cdot': '·', '\\pm': '±', '\\mp': '∓',
    '\\div': '÷', '\\neq': '≠', '\\ne': '≠', '\\leq': '≤',
    '\\le': '≤', '\\geq': '≥', '\\ge': '≥', '\\approx': '≈',
    '\\sim': '∼', '\\equiv': '≡', '\\infty': '∞', '\\sum': '∑',
    '\\prod': '∏', '\\int': '∫', '\\partial': '∂', '\\nabla': '∇',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\cup': '∪',
    '\\cap': '∩', '\\degree': '°', '\\circ': '°', '^{\\circ}': '°', '^\\circ': '°'
  };

  for (const [k, v] of Object.entries(symMap)) {
    res = res.split(k).join(v);
  }

  return res;
}

export function renderKatexHtml(formula: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(formula.trim(), {
      displayMode,
      throwOnError: false,
      output: 'html'
    });
  } catch {
    return convertLatexToUnicode(formula);
  }
}

// Inline token parser for rich formatting (bold, italic, strikethrough, code, link, inline math, image)
function parseInline(text: string): React.ReactNode[] {
  if (!text) return [];

  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // 1. Inline image: ![alt](url)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      const alt = imgMatch[1] || 'Gambar Catatan';
      const src = imgMatch[2].trim();
      nodes.push(
        <span key={`img-${keyIdx++}`} className="inline-block my-2 max-w-full">
          <img
            src={src}
            alt={alt}
            className="max-h-96 rounded-xl border border-neutral-200 dark:border-white/10 object-contain shadow-sm hover:shadow-md transition-shadow bg-neutral-50 dark:bg-black/40"
            loading="lazy"
          />
          {alt && alt !== 'Gambar Catatan' && (
            <span className="block text-center text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 italic">
              {alt}
            </span>
          )}
        </span>
      );
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // 2. Inline math: $...$
    const mathMatch = remaining.match(/^\$([^$\n]+)\$/);
    if (mathMatch) {
      const formula = mathMatch[1];
      const html = renderKatexHtml(formula, false);
      nodes.push(
        <span
          key={`math-${keyIdx++}`}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-300 font-serif text-[0.95em] border border-emerald-500/20"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      remaining = remaining.slice(mathMatch[0].length);
      continue;
    }

    // 3. Inline code: `...`
    const codeMatch = remaining.match(/^`([^`\n]+)`/);
    if (codeMatch) {
      nodes.push(
        <code
          key={`code-${keyIdx++}`}
          className="text-xs px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-white/10 text-amber-700 dark:text-amber-300 border border-neutral-300/60 dark:border-white/10 font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 4. Bold: **...** or __...__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      nodes.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-neutral-900 dark:text-white">
          {parseInline(boldMatch[2])}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 5. Strikethrough: ~~...~~
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      nodes.push(
        <del key={`del-${keyIdx++}`} className="line-through text-neutral-400 dark:text-neutral-500">
          {parseInline(strikeMatch[1])}
        </del>
      );
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // 6. Italic: *...* or _..._
    const italicMatch = remaining.match(/^(\*|_)(.+?)\1/);
    if (italicMatch) {
      nodes.push(
        <em key={`em-${keyIdx++}`} className="italic">
          {parseInline(italicMatch[2])}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 7. Links: [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2].trim();
      const isHttp = /^https?:\/\//i.test(linkUrl) || linkUrl.startsWith('#');

      if (isHttp) {
        nodes.push(
          <a
            key={`a-${keyIdx++}`}
            href={linkUrl}
            target={linkUrl.startsWith('#') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-500 inline-flex items-center gap-0.5"
          >
            {parseInline(linkText)}
            {!linkUrl.startsWith('#') && <ExternalLink className="w-3 h-3 inline opacity-70" />}
          </a>
        );
      } else {
        nodes.push(<span key={`safe-${keyIdx++}`}>{parseInline(linkText)}</span>);
      }
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Default plain text step: take up to next special char
    const nextSpecial = remaining.search(/[!$`*_~\[]/);
    if (nextSpecial === -1) {
      nodes.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      nodes.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      nodes.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return nodes;
}

export const Markdown: React.FC<MarkdownProps> = ({ content, className = '', onToggleChecklist }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  const copyCode = (code: string, idx: number) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {}
  };

  while (i < lines.length) {
    const line = lines[i];

    // 1. Math block: $$ ... $$
    if (line.trim().startsWith('$$')) {
      const mathLines: string[] = [];
      const inlineMath = line.trim().slice(2);
      if (inlineMath.endsWith('$$') && inlineMath.length > 2) {
        mathLines.push(inlineMath.slice(0, -2));
        i++;
      } else {
        if (inlineMath.length > 0) mathLines.push(inlineMath);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const lastLine = lines[i].trim();
          const cleanLast = lastLine.slice(0, -2);
          if (cleanLast.length > 0) mathLines.push(cleanLast);
          i++;
        }
      }
      const rawMath = mathLines.join(' ');
      const renderedHtml = renderKatexHtml(rawMath, true);
      elements.push(
        <div
          key={`mathblock-${blockKey++}`}
          className="my-3 p-4 rounded-xl bg-slate-50 dark:bg-[#070b14] border border-emerald-500/30 text-center overflow-x-auto shadow-2xs text-neutral-900 dark:text-white"
        >
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} className="overflow-x-auto py-1" />
        </div>
      );
      continue;
    }

    // 2. Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const match = line.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const lang = match ? match[1] : '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      const fullCode = codeLines.join('\n');
      const curIdx = blockKey;
      elements.push(
        <div
          key={`codeblock-${blockKey++}`}
          className="my-3 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 text-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400">
            <span className="font-mono uppercase">{lang || 'CODE'}</span>
            <button
              type="button"
              onClick={() => copyCode(fullCode, curIdx)}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px]"
            >
              {copiedIndex === curIdx ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3.5 text-xs overflow-x-auto font-mono leading-relaxed">
            <code>{fullCode}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. Horizontal Rule
    if (/^(---|___|\*\*\*)\s*$/.test(line.trim())) {
      elements.push(
        <hr key={`hr-${blockKey++}`} className="my-4 border-neutral-200 dark:border-white/10" />
      );
      i++;
      continue;
    }

    // 4. Headings 1 - 4
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const parsed = parseInline(text);

      switch (level) {
        case 1:
          elements.push(
            <h1 key={`h1-${blockKey++}`} className="text-xl sm:text-2xl font-bold mt-5 mb-2.5 text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-white/10 pb-2">
              {parsed}
            </h1>
          );
          break;
        case 2:
          elements.push(
            <h2 key={`h2-${blockKey++}`} className="text-lg sm:text-xl font-bold mt-4 mb-2 text-neutral-900 dark:text-white">
              {parsed}
            </h2>
          );
          break;
        case 3:
          elements.push(
            <h3 key={`h3-${blockKey++}`} className="text-sm sm:text-base font-semibold mt-3 mb-1.5 text-neutral-900 dark:text-white">
              {parsed}
            </h3>
          );
          break;
        case 4:
          elements.push(
            <h4 key={`h4-${blockKey++}`} className="text-xs sm:text-sm font-semibold mt-2.5 mb-1 text-neutral-800 dark:text-slate-200">
              {parsed}
            </h4>
          );
          break;
      }
      i++;
      continue;
    }

    // 5. Callouts / Blockquotes: > [!NOTE], > [!TIP], > [!WARNING], > [!DANGER] or generic > ...
    if (line.trim().startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        bqLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }

      const firstLine = bqLines[0] || '';
      const calloutMatch = firstLine.match(/^\[!(NOTE|INFO|TIP|SUCCESS|WARNING|DANGER|IMPORTANT)\]/i);

      if (calloutMatch) {
        const type = calloutMatch[1].toUpperCase();
        const contentLines = [firstLine.replace(/^\[![^\]]+\]\s*/i, ''), ...bqLines.slice(1)].filter(Boolean);

        let icon = <Info className="w-4 h-4 shrink-0 text-blue-500" />;
        let borderClass = 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200';
        let label = 'INFORMASI';

        if (type === 'TIP' || type === 'SUCCESS') {
          icon = <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />;
          borderClass = 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200';
          label = 'TIPS & PRAKTIK TERBAIK';
        } else if (type === 'WARNING' || type === 'IMPORTANT') {
          icon = <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />;
          borderClass = 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200';
          label = 'PERHATIAN';
        } else if (type === 'DANGER') {
          icon = <AlertOctagon className="w-4 h-4 shrink-0 text-red-500" />;
          borderClass = 'border-red-500/30 bg-red-500/5 text-red-900 dark:text-red-200';
          label = 'BAHAYA KRITIS';
        }

        elements.push(
          <div
            key={`callout-${blockKey++}`}
            className={`p-3.5 my-3 rounded-xl border flex items-start gap-3 text-xs sm:text-sm leading-relaxed ${borderClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[10px] uppercase tracking-wider opacity-80 mb-1">
                {label}
              </div>
              {contentLines.map((cl, idx) => (
                <p key={idx} className="my-0.5 leading-relaxed">{parseInline(cl)}</p>
              ))}
            </div>
          </div>
        );
        continue;
      }

      elements.push(
        <blockquote
          key={`bq-${blockKey++}`}
          className="border-l-4 border-amber-500 pl-4 py-2 my-2.5 italic text-neutral-700 dark:text-slate-300 bg-amber-500/5 rounded-r-xl text-xs sm:text-sm"
        >
          {bqLines.map((bql, idx) => (
            <p key={idx} className="my-0.5 leading-relaxed">{parseInline(bql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 6. Interactive Task Checklist: - [ ] or - [x]
    if (/^[-*+]\s+\[([ xX])\]\s+/.test(line.trim())) {
      const checkItems: Array<{ checked: boolean; text: string }> = [];
      while (i < lines.length && /^[-*+]\s+\[([ xX])\]\s+/.test(lines[i].trim())) {
        const m = lines[i].trim().match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
        if (m) {
          checkItems.push({
            checked: m[1].toLowerCase() === 'x',
            text: m[2]
          });
        }
        i++;
      }

      elements.push(
        <div key={`checklist-${blockKey++}`} className="my-2.5 space-y-1.5">
          {checkItems.map((item, idx) => (
            <label
              key={idx}
              className="flex items-start gap-2.5 text-xs sm:text-sm cursor-pointer select-none group"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => onToggleChecklist && onToggleChecklist(item.text, e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 dark:border-neutral-600 text-amber-500 focus:ring-amber-500"
              />
              <span className={`leading-relaxed ${item.checked ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-slate-200'}`}>
                {parseInline(item.text)}
              </span>
            </label>
          ))}
        </div>
      );
      continue;
    }

    // 7. Markdown Table: rows with '|'
    if (line.trim().startsWith('|') && line.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].includes('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (r: string) =>
          r.split('|').slice(1, -1).map(c => c.trim());

        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);

        elements.push(
          <div key={`tbl-${blockKey++}`} className="overflow-x-auto my-3 rounded-xl border border-neutral-200 dark:border-white/10 shadow-2xs">
            <table className="w-full text-left text-xs divide-y divide-neutral-200 dark:divide-white/10">
              <thead className="bg-neutral-100 dark:bg-white/[0.04]">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3.5 py-2.5 font-bold text-neutral-900 dark:text-white">
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05] bg-white dark:bg-[#070b14]">
                {rows.map((r, rIdx) => (
                  <tr key={rIdx} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                    {r.map((c, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 text-neutral-700 dark:text-slate-300 text-[11px]">
                        {parseInline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 8. Bullet List: - , * , +
    if (/^[-*+]\s+/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${blockKey++}`} className="list-disc pl-5 my-2 space-y-1 text-neutral-800 dark:text-slate-200 text-xs sm:text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 9. Numbered List: 1. , 2. , etc.
    if (/^\d+\.\s+/.test(line.trim())) {
      const numItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        numItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${blockKey++}`} className="list-decimal pl-5 my-2 space-y-1 text-neutral-800 dark:text-slate-200 text-xs sm:text-sm">
          {numItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 10. Standalone Image line: ![alt](url)
    const imgLineMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgLineMatch) {
      const alt = imgLineMatch[1] || 'Gambar Catatan';
      const src = imgLineMatch[2].trim();
      elements.push(
        <div key={`img-block-${blockKey++}`} className="my-4 flex flex-col items-center">
          <img
            src={src}
            alt={alt}
            className="max-h-[500px] w-auto max-w-full rounded-2xl border border-neutral-200 dark:border-white/10 object-contain shadow-md bg-neutral-50 dark:bg-black/40"
            loading="lazy"
          />
          {alt && alt !== 'Gambar Catatan' && (
            <span className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-2 font-medium">
              {alt}
            </span>
          )}
        </div>
      );
      i++;
      continue;
    }

    // 11. Empty line
    if (line.trim() === '') {
      elements.push(<div key={`empty-${blockKey++}`} className="h-2.5" />);
      i++;
      continue;
    }

    // 12. Default paragraph
    elements.push(
      <p key={`p-${blockKey++}`} className="my-1.5 leading-relaxed text-neutral-800 dark:text-slate-200 text-xs sm:text-sm">
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
};
