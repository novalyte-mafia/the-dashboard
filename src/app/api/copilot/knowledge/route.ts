import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { retrieveKnowledge, seedKnowledgeToDatabase } from "@/lib/knowledge/retrieval";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const category = req.nextUrl.searchParams.get("category");

  if (q) {
    const result = await retrieveKnowledge({ query: q, limit: 8 });
    return NextResponse.json(result);
  }

  try {
    const supabase = getSupabaseAdmin() as any;
    let query = supabase
      .from("copilot_knowledge_entries")
      .select("id, category, title, content, tags, keywords, call_stages, approval_status, external_approved, confidence, source_section, updated_at, copilot_knowledge_sources(name, source_path)")
      .eq("is_enabled", true)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch {
    const { APPROVED_KNOWLEDGE_SEED } = await import("@/lib/knowledge/seed-approved");
    return NextResponse.json({
      entries: APPROVED_KNOWLEDGE_SEED,
      source: "seed_fallback",
    });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "seed") {
    try {
      const result = await seedKnowledgeToDatabase();
      return NextResponse.json({ ok: true, ...result });
    } catch (error: any) {
      return NextResponse.json({ error: error?.message ?? "Seed failed" }, { status: 500 });
    }
  }

  if (body.action === "test_retrieval") {
    const query = String(body.query ?? "");
    const result = await retrieveKnowledge({ query, stage: body.stage, limit: 8 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
