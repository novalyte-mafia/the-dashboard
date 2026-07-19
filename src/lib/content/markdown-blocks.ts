import type { JournalArticleBlock } from "@/lib/journal-article-v1";
import { normalizeJournalSlug } from "@/lib/journal-article-v1";

/**
 * Deterministic Markdown -> JournalArticleV1 block conversion used for GLM
 * output. Supports the subset the Journal renderer understands: h2/h3
 * headings, paragraphs, ordered/unordered lists, pipe tables, images, and
 * blockquote callouts ("> **Tip:** ..." / "> **Warning:** ..." / plain "> ").
 */

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\s][^*]*)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function headingId(text: string, used: Set<string>): string {
  const base = normalizeJournalSlug(stripInlineMarkdown(text).replace(/[*_`]/g, "")) || "section";
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

const CALLOUT_TONES: Record<string, "info" | "warning" | "tip"> = {
  note: "info",
  info: "info",
  important: "info",
  warning: "warning",
  caution: "warning",
  disclaimer: "warning",
  tip: "tip",
};

export function markdownToBlocks(markdown: string): {
  blocks: JournalArticleBlock[];
  tableOfContents: { id: string; title: string }[];
} {
  const blocks: JournalArticleBlock[] = [];
  const toc: { id: string; title: string }[] = [];
  const usedIds = new Set<string>();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || /^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const rawLevel = headingMatch[1].length;
      const text = stripInlineMarkdown(headingMatch[2]).replace(/[*_`]/g, "").trim();
      if (text) {
        // H1 is reserved for the article title; clamp everything else to h2/h3.
        if (rawLevel === 1) {
          i += 1;
          continue;
        }
        const level: 2 | 3 = rawLevel <= 2 ? 2 : 3;
        const id = headingId(text, usedIds);
        blocks.push({ type: "heading", level, text, id });
        if (level === 2) toc.push({ id, title: text });
      }
      i += 1;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (imageMatch) {
      blocks.push({
        type: "image",
        src: imageMatch[2],
        alt: imageMatch[1] || "Article image",
        caption: imageMatch[3] || undefined,
      });
      i += 1;
      continue;
    }

    const videoMatch = trimmed.match(
      /^\[Video:\s*([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"([^"]*)")?\)$/i,
    );
    if (videoMatch) {
      blocks.push({
        type: "video",
        title: videoMatch[1].trim(),
        url: videoMatch[2],
        caption: videoMatch[3] || undefined,
      });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      const text = stripInlineMarkdown(quoteLines.join(" ").trim());
      const toneMatch = text.match(/^([A-Za-z]+):\s*/);
      const tone = toneMatch ? CALLOUT_TONES[toneMatch[1].toLowerCase()] : undefined;
      const body = tone && toneMatch ? text.slice(toneMatch[0].length).trim() : text;
      if (body) {
        blocks.push({ type: "callout", tone: tone ?? "info", text: body });
      }
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = parseTableRow(line).map(stripInlineMarkdown);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const row = parseTableRow(lines[i]).map(stripInlineMarkdown);
        while (row.length < headers.length) row.push("");
        rows.push(row.slice(0, headers.length));
        i += 1;
      }
      if (headers.length && rows.length) {
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        const m = ordered ? itemLine.match(/^\d+[.)]\s+(.*)$/) : itemLine.match(/^[-*+]\s+(.*)$/);
        if (!m) break;
        items.push(stripInlineMarkdown(m[1]));
        i += 1;
        // Absorb wrapped continuation lines indented under the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s/.test(lines[i])) {
          items[items.length - 1] += ` ${stripInlineMarkdown(lines[i].trim())}`;
          i += 1;
        }
      }
      if (items.length) blocks.push({ type: "list", items, ordered: ordered || undefined });
      continue;
    }

    // Paragraph: absorb consecutive non-empty, non-structural lines.
    const paragraphLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        /^#{1,6}\s/.test(next) ||
        next.startsWith(">") ||
        /^[-*+]\s/.test(next) ||
        /^\d+[.)]\s/.test(next) ||
        /^\|.*\|$/.test(next) ||
        /^!\[/.test(next) ||
        /^\[Video:/i.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    const paragraph = stripInlineMarkdown(paragraphLines.join(" "));
    if (paragraph) blocks.push({ type: "paragraph", text: paragraph });
  }

  return { blocks, tableOfContents: toc };
}

export function countWords(markdown: string): number {
  return markdown
    .replace(/[#>*_`|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function estimateReadingTime(markdown: string): number {
  return Math.max(1, Math.round(countWords(markdown) / 225));
}
