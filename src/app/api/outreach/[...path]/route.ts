import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { OutreachValidationError } from "@/lib/outreach/validation";
import * as outreach from "@/lib/outreach/service";
import * as workspace from "@/lib/outreach/workspace";
import * as drafts from "@/lib/outreach/draft-pipeline";
import { OUTREACH_MAX_ENRICH } from "@/lib/outreach/accounts";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function errorResponse(error: unknown) {
  if (error instanceof OutreachValidationError) {
    return json({ error: error.message, field: error.field }, 400);
  }
  return json({ error: "Outreach request failed." }, 500);
}

async function readBody(req: NextRequest) {
  return req.json().catch(() => ({}));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return json({ error: "Unauthorized" }, 401);
  const { path = [] } = await ctx.params;
  const [a, b, c] = path;
  try {
    if (a === "metrics" && !b) return json({ metrics: outreach.metrics() });
    if (a === "command-center" && !b) return json(workspace.commandCenter());
    if (a === "activity" && !b) {
      const range = (req.nextUrl.searchParams.get("range") as "today" | "7d" | "30d" | "all") || "all";
      return json({ activity: outreach.listActivity(range) });
    }
    if (a === "jobs" && !b) return json({ jobs: outreach.listResearchJobs() });
    if (a === "jobs" && b && !c) {
      const job = outreach.getResearchJob(b);
      if (!job) return json({ error: "Not found" }, 404);
      return json({ job });
    }
    if (a === "integrations" && !b) return json(workspace.integrationHealth());
    if (a === "meta-searches" && !b) return json({ searches: workspace.listMetaSearches() });
    if (a === "meta-searches" && b === "preview") {
      return json(workspace.previewOfficialMetaUrl(Object.fromEntries(req.nextUrl.searchParams)));
    }
    if (a === "meta-searches" && b && !c) {
      const detail = workspace.getMetaSearch(b);
      if (!detail) return json({ error: "Not found" }, 404);
      return json(detail);
    }
    if (a === "meta-results" && !b) {
      const sp = req.nextUrl.searchParams;
      return json({
        results: workspace.listMetaResults({
          searchId: sp.get("searchId") ?? undefined,
          unmatched: sp.get("unmatched") === "true",
          matched: sp.get("matched") === "true",
          unreviewed: sp.get("unreviewed") === "true",
        }),
      });
    }
    if (a === "meta-saved-searches" && !b) return json(workspace.listSavedMetaSearches());
    if (a === "queue" && !b) return json({ queue: outreach.researchQueue() });
    if (a === "contacts" && !b) {
      const channel = req.nextUrl.searchParams.get("channelType") as never;
      const includeSuppressed = req.nextUrl.searchParams.get("includeSuppressed") === "true";
      return json({ contacts: outreach.listContacts({ channelType: channel, includeSuppressed }) });
    }
    if (a === "evidence" && !b) return json({ evidence: outreach.listEvidenceLibrary() });
    if (a === "drafts" && !b) return json({ drafts: drafts.listDrafts() });
    if (a === "settings" && !b) return json(outreach.getSettings());
    if (a === "saved-views" && !b) return json({ views: outreach.listSavedViews() });
    if (a === "research-jobs" && b) {
      const job = outreach.getResearchJob(b);
      if (!job) return json({ error: "Not found" }, 404);
      return json({ job });
    }
    if (a === "prospects" && !b) {
      const sp = req.nextUrl.searchParams;
      const rows = outreach.listProspects({
        q: sp.get("q") ?? undefined,
        status: (sp.get("status") as never) ?? undefined,
        statusGroup: (sp.get("statusGroup") as never) ?? "active",
        vertical: (sp.get("vertical") as never) ?? undefined,
        city: sp.get("city") ?? undefined,
        state: sp.get("state") ?? undefined,
        country: sp.get("country") ?? undefined,
        sourceType: (sp.get("sourceType") as never) ?? undefined,
        adSignal: (sp.get("adSignal") as never) ?? undefined,
        websiteStatus: (sp.get("websiteStatus") as never) ?? undefined,
        contactRoute: (sp.get("contactRoute") as never) ?? undefined,
        confidence: (sp.get("confidence") as never) ?? undefined,
        discoveredFrom: sp.get("discoveredFrom") ?? undefined,
        discoveredTo: sp.get("discoveredTo") ?? undefined,
        researchedFrom: sp.get("researchedFrom") ?? undefined,
        researchedTo: sp.get("researchedTo") ?? undefined,
        dataMode: (sp.get("dataMode") as never) ?? undefined,
        includeSuppressed: sp.get("includeSuppressed") === "true",
        includeArchived: sp.get("includeArchived") === "true",
      });
      if (sp.get("format") === "csv") {
        const includeSuppressed = sp.get("includeSuppressed") === "true";
        if (includeSuppressed && sp.get("confirmSuppressed") !== "true") {
          return json({ error: "Exporting suppressed contacts requires confirmSuppressed=true." }, 400);
        }
        return new NextResponse(outreach.csvExport(includeSuppressed), {
          headers: { "Content-Type": "text/csv; charset=utf-8" },
        });
      }
      return json({ prospects: rows, total: rows.length });
    }
    if (a === "prospects" && b && !c) {
      const detail = outreach.getProspect(b);
      if (!detail) return json({ error: "Not found" }, 404);
      return json(detail);
    }
    if (a === "prospects" && b && c === "evidence") return json({ evidence: outreach.getProspect(b)?.evidence ?? [] });
    if (a === "prospects" && b && c === "contact-routes") return json({ contactRoutes: outreach.getProspect(b)?.contactRoutes ?? [] });
    if (a === "prospects" && b && c === "activity") return json({ activity: outreach.getProspect(b)?.activity ?? [] });
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const admin = await requireAdminRole();
  if (!admin) return json({ error: "Unauthorized" }, 401);
  const { path = [] } = await ctx.params;
  const [a, b, c] = path;
  const actorId = admin.id;
  try {
    const body = await readBody(req);
    if (a === "prospects" && !b) return json({ prospect: outreach.createProspect(body, actorId) }, 201);
    if (a === "prospects" && b && c === "archive") return json({ prospect: outreach.archiveProspect(b, actorId) });
    if (a === "prospects" && b && c === "restore") return json({ prospect: outreach.restoreProspect(b, actorId) });
    if (a === "prospects" && b && c === "suppress") return json({ prospect: outreach.suppressProspect(b, String(body.reason ?? "Operator suppressed"), actorId) });
    if (a === "prospects" && b && c === "mark-research-ready") {
      const result = outreach.markResearchReady(b, actorId);
      if ("error" in result && result.error === "not_found") return json({ error: "Not found" }, 404);
      if ("error" in result) return json({ error: "Not research ready", ...result }, 400);
      return json(result);
    }
    if (a === "prospects" && b && c === "evidence") return json({ evidence: outreach.addEvidence(b, body, actorId) }, 201);
    if (a === "prospects" && b && c === "contact-routes") return json({ contactRoute: outreach.addContactRoute(b, body, actorId) }, 201);
    if (a === "prospects" && b && c === "notes") return json({ activity: outreach.addNote(b, String(body.body ?? ""), actorId) }, 201);
    if (a === "prospects" && b && c === "draft") return json(await drafts.runDraftPass1(b, actorId), 201);
    if (a === "prospects" && b && c === "verify-draft") return json(await drafts.runDraftPass2(b, actorId));
    if (a === "prospects" && b && c === "log-send") return json({ prospect: drafts.logConsoleSend(b, actorId) });
    if (a === "prospects" && b && c === "log-copy") return json({ prospect: drafts.logFormCopy(b, actorId) });
    if (a === "drafts" && b === "batch") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, OUTREACH_MAX_ENRICH) : [];
      const pass = body.pass === 2 ? 2 : 1;
      const results = [];
      for (const id of ids) {
        results.push(pass === 2 ? await drafts.runDraftPass2(id, actorId) : await drafts.runDraftPass1(id, actorId));
      }
      return json({ results });
    }
    if (a === "prospects" && b && c === "research") {
      const job = outreach.startResearch(b, String(body.adapterName ?? "website_research"), actorId, body.idempotencyKey);
      const executed = job.status === "QUEUED" ? await workspace.executeResearchJob(job.id) : job;
      return json({ job: executed });
    }
    if (a === "bulk-research" && !b) {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, OUTREACH_MAX_ENRICH) : [];
      const adapterName = String(body.adapterName ?? "website_research");
      const jobs = [];
      for (const id of ids) {
        const job = outreach.startResearch(id, adapterName, actorId);
        jobs.push(job.status === "QUEUED" ? await workspace.executeResearchJob(job.id) : job);
      }
      return json({ jobs });
    }
    if (a === "jobs" && b && c === "retry") {
      const next = workspace.retryResearchJob(b, actorId);
      const executed = next.status === "QUEUED" ? await workspace.executeResearchJob(next.id) : next;
      return json({ job: executed });
    }
    if (a === "jobs" && b && c === "cancel") {
      return json({ job: outreach.cancelResearchJob(b, actorId) });
    }
    if (a === "meta-searches" && !b) {
      return json(await workspace.runMetaSearch({ query: body.query ?? body, name: body.name, actorId, savedSearchId: body.savedSearchId }), 201);
    }
    if (a === "meta-searches" && b && c === "rerun") {
      const existing = workspace.getMetaSearch(b);
      if (!existing) return json({ error: "Not found" }, 404);
      return json(await workspace.runMetaSearch({ query: existing.search.query, name: existing.search.name, actorId }));
    }
    if (a === "meta-results" && b && c === "attach") {
      return json({ result: workspace.attachMetaResult(b, String(body.prospectId), actorId) });
    }
    if (a === "meta-results" && b && c === "create-clinic") {
      return json(workspace.createClinicFromMetaResult(b, actorId), 201);
    }
    if (a === "meta-results" && b && c === "dismiss") {
      return json({ result: workspace.dismissMetaResult(b) });
    }
    if (a === "meta-saved-searches" && !b) {
      return json({ search: workspace.saveMetaSearchPreset({ name: String(body.name ?? "Saved search"), query: body.query, actorId }) }, 201);
    }
    if (a === "saved-views" && !b) return json({ view: outreach.upsertSavedView({ ...body, userId: actorId }) }, 201);
    if (a === "settings" && b === "test-connector") return json(outreach.testConnector(String(body.name ?? "")));
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const admin = await requireAdminRole();
  if (!admin) return json({ error: "Unauthorized" }, 401);
  const { path = [] } = await ctx.params;
  const [a, b, c] = path;
  try {
    const body = await readBody(req);
    if (a === "prospects" && b && c === "draft") return json({ prospect: drafts.saveDraftEdits(b, body, admin.id) });
    if (a === "prospects" && b) return json({ prospect: outreach.updateProspect(b, body, admin.id) });
    if (a === "evidence" && b) return json({ evidence: outreach.updateEvidence(b, body, admin.id) });
    if (a === "contact-routes" && b) return json({ contactRoute: outreach.updateContactRoute(b, body, admin.id) });
    if (a === "saved-views" && b) return json({ view: outreach.upsertSavedView({ ...body, id: b, userId: admin.id, name: body.name ?? "View" }) });
    if (a === "settings" && !b) return json(outreach.patchSettings(body));
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const admin = await requireAdminRole();
  if (!admin) return json({ error: "Unauthorized" }, 401);
  const { path = [] } = await ctx.params;
  const [a, b] = path;
  try {
    if (a === "prospects" && b) {
      outreach.archiveProspect(b, admin.id);
      return json({ ok: true });
    }
    if (a === "evidence" && b) return json({ ok: outreach.deleteEvidence(b, admin.id) });
    if (a === "contact-routes" && b) return json({ ok: outreach.deleteContactRoute(b, admin.id) });
    if (a === "meta-saved-searches" && b) return json({ ok: workspace.deleteSavedMetaSearch(b) });
    return json({ error: "Not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
