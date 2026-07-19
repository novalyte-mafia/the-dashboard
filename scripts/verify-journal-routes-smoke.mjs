/**
 * Static smoke checklist for Journal content platform wiring.
 * Does not hit live Supabase/GLM (those need env + applied migrations).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

const dashboard = path.resolve(import.meta.dirname, "..");
const marketing = path.resolve(dashboard, "../z.ai-novalyte-new-homepage");

const required = [
  [dashboard, "src/lib/journal-article-v1.ts"],
  [dashboard, "src/lib/content/article-mapper.ts"],
  [dashboard, "src/lib/content/article-store.ts"],
  [dashboard, "src/app/api/content/articles/route.ts"],
  [dashboard, "src/app/api/content/articles/[id]/route.ts"],
  [dashboard, "src/app/api/content/articles/[id]/actions/route.ts"],
  [dashboard, "src/app/api/content/articles/[id]/revisions/route.ts"],
  [dashboard, "src/app/api/content/articles/[id]/preview-token/route.ts"],
  [dashboard, "src/app/api/content/media/route.ts"],
  [dashboard, "src/app/api/content/media/attach/route.ts"],
  [dashboard, "src/app/api/content/generate/outline/route.ts"],
  [dashboard, "src/app/api/content/keywords/route.ts"],
  [dashboard, "src/components/admin/views/content-studio.tsx"],
  [marketing, "src/app/journal/page.tsx"],
  [marketing, "src/app/journal/[slug]/page.tsx"],
  [marketing, "src/app/journal/category/[slug]/page.tsx"],
  [marketing, "src/app/journal/preview/[token]/page.tsx"],
  [marketing, "src/app/api/journal/revalidate/route.ts"],
  [marketing, "supabase/migrations/20260718130934_journal_article_v1_schema.sql"],
];

for (const [root, rel] of required) {
  assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
}

console.log("verify-journal-routes-smoke: ok");
console.log("Manual cutover still required:");
console.log("- Apply JournalArticleV1 + provenance migrations on shared Supabase");
console.log("- Set MARKETING_SITE_URL, JOURNAL_PREVIEW_SECRET, JOURNAL_REVALIDATE_SECRET on both apps");
console.log("- Set DATAFORSEO_LOGIN/PASSWORD for live keyword metrics");
console.log("- Import seven hardcoded ARTICLES for parity before JOURNAL_SOURCE=supabase");
