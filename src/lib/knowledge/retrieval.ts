import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { APPROVED_KNOWLEDGE_SEED } from "./seed-approved";
import { detectKnowledgeCategories, tokenizeForSearch } from "./intent";
import type { KnowledgeEntrySeed, RetrievedKnowledgeChunk } from "./types";

type DbEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[] | null;
  keywords: string[] | null;
  call_stages: string[] | null;
  confidence: number | null;
  source_section: string | null;
  copilot_knowledge_sources?: { name: string; source_path: string | null } | null;
};

function scoreSeedEntry(entry: KnowledgeEntrySeed, query: string, categories: string[]): number {
  const tokens = tokenizeForSearch(query);
  let score = categories.includes(entry.category) ? 2 : 0;

  for (const token of tokens) {
    if (entry.keywords.some((k) => k.toLowerCase().includes(token))) score += 3;
    if (entry.tags.some((t) => t.toLowerCase().includes(token))) score += 1;
    if (entry.title.toLowerCase().includes(token)) score += 2;
    if (entry.content.toLowerCase().includes(token)) score += 0.5;
  }

  return score * entry.confidence;
}

function mapSeedToChunk(entry: KnowledgeEntrySeed, score: number): RetrievedKnowledgeChunk {
  return {
    id: entry.id,
    category: entry.category,
    title: entry.title,
    content: entry.content,
    source: entry.sourceFile,
    section: entry.sourceSection,
    score,
    confidence: entry.confidence,
  };
}

function mapDbToChunk(entry: DbEntry, score: number): RetrievedKnowledgeChunk {
  return {
    id: entry.id,
    category: entry.category as RetrievedKnowledgeChunk["category"],
    title: entry.title,
    content: entry.content,
    source: entry.copilot_knowledge_sources?.source_path ?? entry.copilot_knowledge_sources?.name ?? "database",
    section: entry.source_section ?? "",
    score,
    confidence: Number(entry.confidence ?? 0.85),
  };
}

async function retrieveFromDatabase(query: string, categories: string[], limit: number): Promise<RetrievedKnowledgeChunk[]> {
  try {
    const supabase = getSupabaseAdmin() as any;
    const tokens = tokenizeForSearch(query).slice(0, 8).join(" | ");
    let dbQuery = supabase
      .from("copilot_knowledge_entries")
      .select("id, category, title, content, tags, keywords, call_stages, confidence, source_section, copilot_knowledge_sources(name, source_path)")
      .eq("is_enabled", true)
      .eq("approval_status", "approved")
      .eq("external_approved", true)
      .limit(limit * 3);

    if (categories.length) {
      dbQuery = dbQuery.in("category", categories);
    }

    if (tokens) {
      dbQuery = dbQuery.textSearch("search_document", tokens, { type: "websearch", config: "english" });
    }

    const { data, error } = await dbQuery;
    if (error || !data?.length) return [];

    const tokensList = tokenizeForSearch(query);
    return (data as DbEntry[])
      .map((entry) => {
        let score = categories.includes(entry.category) ? 2 : 0;
        const haystack = `${entry.title} ${entry.content} ${(entry.keywords ?? []).join(" ")}`.toLowerCase();
        for (const token of tokensList) {
          if (haystack.includes(token)) score += 1;
        }
        return mapDbToChunk(entry, score);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

function retrieveFromSeed(query: string, categories: string[], limit: number): RetrievedKnowledgeChunk[] {
  return APPROVED_KNOWLEDGE_SEED.map((entry) => ({
    entry,
    score: scoreSeedEntry(entry, query, categories),
  }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score }) => mapSeedToChunk(entry, score));
}

export async function retrieveKnowledge(input: {
  query: string;
  stage?: string;
  limit?: number;
}): Promise<{ chunks: RetrievedKnowledgeChunk[]; categories: string[]; latencyMs: number }> {
  const started = Date.now();
  const limit = input.limit ?? 5;
  const categories = detectKnowledgeCategories(input.query, input.stage);

  const dbChunks = await retrieveFromDatabase(input.query, categories, limit);
  const chunks = dbChunks.length >= 2 ? dbChunks : retrieveFromSeed(input.query, categories, limit);

  // Always include compliance guardrails when discussing guarantees or compliance topics
  if (/guarantee|hipaa|patient records|legal|certified/i.test(input.query)) {
    const guard = APPROVED_KNOWLEDGE_SEED.find((e) => e.id === "compliance-no-guarantee-001" || e.id === "compliance-hipaa-001");
    if (guard && !chunks.some((c) => c.id === guard.id)) {
      chunks.unshift(mapSeedToChunk(guard, 5));
    }
  }

  return {
    chunks: chunks.slice(0, limit),
    categories,
    latencyMs: Date.now() - started,
  };
}

export function formatKnowledgeForPrompt(chunks: RetrievedKnowledgeChunk[]): string {
  if (!chunks.length) return "No approved Novalyte AI knowledge matched this moment. Use safe fallback language.";
  return chunks
    .map((c, i) => `[${i + 1}] ${c.title} (${c.source}${c.section ? ` · ${c.section}` : ""})\n${c.content}`)
    .join("\n\n");
}

export async function seedKnowledgeToDatabase(): Promise<{ inserted: number; sourceId: string }> {
  const supabase = getSupabaseAdmin() as any;
  const sourceName = "Approved seed bundle v1";
  const { data: existingSource } = await supabase
    .from("copilot_knowledge_sources")
    .select("id")
    .eq("name", sourceName)
    .maybeSingle();

  let sourceId = existingSource?.id as string | undefined;
  if (!sourceId) {
    const { data: created, error } = await supabase
      .from("copilot_knowledge_sources")
      .insert({
        name: sourceName,
        source_type: "seed",
        source_path: "src/lib/knowledge/seed-approved.ts",
        approval_status: "approved",
        version: "1.0",
        last_reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    sourceId = created.id;
  }

  const rows = APPROVED_KNOWLEDGE_SEED.map((entry) => ({
    source_id: sourceId,
    category: entry.category,
    title: entry.title,
    content: entry.content,
    tags: entry.tags,
    keywords: entry.keywords,
    call_stages: entry.callStages,
    approval_status: "approved",
    external_approved: entry.externalApproved,
    confidence: entry.confidence,
    source_section: entry.sourceSection,
    version: "1.0",
  }));

  const { error: upsertError } = await supabase
    .from("copilot_knowledge_entries")
    .upsert(rows, { onConflict: "title", ignoreDuplicates: false });

  // title may not be unique — fallback to delete+insert for seed bundle
  if (upsertError) {
    await supabase.from("copilot_knowledge_entries").delete().eq("source_id", sourceId);
    const { error: insertError } = await supabase.from("copilot_knowledge_entries").insert(rows);
    if (insertError) throw insertError;
  }

  return { inserted: rows.length, sourceId: sourceId! };
}
