import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { researchClinicIntelligence } from "@/lib/clinic-intelligence";

const schema = z.object({
  marketSlug: z.string().default("miami-fl"),
  limit: z.number().int().min(1).max(25).default(8),
  force: z.boolean().optional(),
  statuses: z
    .array(z.enum(["not_started", "failed", "stale", "queued", "needs_review"]))
    .optional(),
});

/**
 * Controlled bulk research for a Market Sprint.
 * Processes a small batch per request to respect Firecrawl/GLM limits.
 */
export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json().catch(() => ({})));
  const supabase = getSupabaseAdmin();

  const { data: sprint } = await supabase
    .from("market_sprints")
    .select("id, slug, name")
    .eq("slug", body.marketSlug)
    .maybeSingle();
  if (!sprint) return NextResponse.json({ error: "Market sprint not found" }, { status: 404 });

  const { data: members } = await supabase
    .from("market_sprint_clinics")
    .select("clinic_id, duplicate_of_clinic_id")
    .eq("market_sprint_id", sprint.id);

  const clinicIds = (members ?? [])
    .filter((m) => !m.duplicate_of_clinic_id)
    .map((m) => m.clinic_id);

  if (!clinicIds.length) {
    return NextResponse.json({ ok: true, processed: 0, message: "No clinics in market." });
  }

  const { data: existingProfiles } = await supabase
    .from("clinic_intelligence_profiles")
    .select("clinic_id, research_status")
    .in("clinic_id", clinicIds);

  const byId = new Map((existingProfiles ?? []).map((p) => [p.clinic_id, p.research_status]));
  const wanted = new Set(body.statuses ?? ["not_started", "failed", "stale", "queued"]);

  const candidates = clinicIds.filter((id) => {
    const status = byId.get(id) ?? "not_started";
    if (body.force) return true;
    return wanted.has(status as any) || status === "not_started" || !byId.has(id);
  });

  const batch = candidates.slice(0, body.limit);

  const { data: job } = await supabase
    .from("clinic_research_jobs")
    .insert({
      market_sprint_id: sprint.id,
      status: "running",
      total: batch.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      clinic_ids: batch,
      created_by: admin.email || admin.id,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  const errors: Array<{ clinicId: string; error: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const clinicId of batch) {
    try {
      await researchClinicIntelligence(clinicId, { force: body.force, adminId: admin.id });
      succeeded += 1;
    } catch (err) {
      failed += 1;
      errors.push({ clinicId, error: err instanceof Error ? err.message : "failed" });
    }
    if (job?.id) {
      await supabase
        .from("clinic_research_jobs")
        .update({
          completed: succeeded + failed,
          succeeded,
          failed,
          errors,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }

  if (job?.id) {
    await supabase
      .from("clinic_research_jobs")
      .update({
        status: failed && !succeeded ? "failed" : "completed",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  return NextResponse.json({
    ok: true,
    jobId: job?.id ?? null,
    marketSlug: body.marketSlug,
    candidates: candidates.length,
    processed: batch.length,
    succeeded,
    failed,
    remaining: Math.max(0, candidates.length - batch.length),
    errors,
  });
}

export async function GET(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("jobId");
  const supabase = getSupabaseAdmin();
  if (jobId) {
    const { data } = await supabase.from("clinic_research_jobs").select("*").eq("id", jobId).maybeSingle();
    return NextResponse.json({ job: data });
  }
  const { data } = await supabase
    .from("clinic_research_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  return NextResponse.json({ jobs: data ?? [] });
}
