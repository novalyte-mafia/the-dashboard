/**
 * Smoke checks for Journal content helpers (no vitest in this repo).
 * Run: node --import tsx scripts/verify-journal-content.mjs
 * or:  npx tsx scripts/verify-journal-content.mjs
 */

import assert from "node:assert/strict";
import {
  countWords,
  estimateReadingTime,
  markdownToBlocks,
} from "../src/lib/content/markdown-blocks.ts";
import { normalizeJournalSlug } from "../src/lib/journal-article-v1.ts";
import {
  computeAdvisorySeoScore,
  rowToJournalArticle,
} from "../src/lib/content/article-mapper.ts";

const md = [
  "# Title Ignored",
  "",
  "## Benefits",
  "",
  "Testosterone therapy can help carefully selected patients.",
  "",
  "- First point",
  "- Second point",
  "",
  "> **Tip:** Talk with a licensed clinician.",
].join("\n");

const { blocks, tableOfContents } = markdownToBlocks(md);
assert.deepEqual(tableOfContents, [{ id: "benefits", title: "Benefits" }]);
assert.equal(blocks[0].type, "heading");
assert.ok(blocks.some((b) => b.type === "callout" && b.tone === "tip"));

const words = Array.from({ length: 450 }, () => "word").join(" ");
assert.equal(countWords(words), 450);
assert.equal(estimateReadingTime(words), 2);
assert.equal(normalizeJournalSlug(" TRT Therapy Guide! "), "trt-therapy-guide");

const article = rowToJournalArticle({
  id: "art_test",
  title: "Legacy Article",
  slug: "Legacy Article",
  content: "## Hello\n\nBody copy here.",
  authorName: "Editor",
  status: "draft",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
assert.deepEqual(article.keywords.secondary, []);
assert.equal(article.author.name, "Editor");
assert.ok(article.body.length > 0);
assert.ok(computeAdvisorySeoScore(article).checks.length > 0);

console.log("verify-journal-content: ok");
