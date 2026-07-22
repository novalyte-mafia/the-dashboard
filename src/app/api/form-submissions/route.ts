import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("retry"),
    submissionId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("mark_read"),
    submissionId: z.string().uuid(),
    isRead: z.boolean(),
  }),
  z.object({
    action: z.literal("follow_up"),
    submissionId: z.string().uuid(),
    status: z.enum(["new", "in_progress", "waiting", "completed", "closed"]),
    assignedOwner: z.string().trim().max(200).nullable().optional(),
  }),
]);

const ALLOWED_NOTIFICATION_STATUSES = new Set([
  "pending",
  "sent",
  "partially_sent",
  "failed",
  "retrying",
]);

export async function GET(request: NextRequest) {
  if (!(await requireAdminRole(["admin", "operations"]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 50)));
  const offset = Math.max(0, Number(params.get("offset") || 0));
  const admin = getSupabaseAdmin();
  let query = admin
    .from("form_submissions")
    .select("*, deliveries:form_notification_deliveries(*)", { count: "exact" })
    .order("submitted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const formType = params.get("formType");
  const notificationStatus = params.get("notificationStatus");
  const source = params.get("source");
  const campaign = params.get("campaign");
  const read = params.get("read");
  const followUp = params.get("followUp");
  const from = params.get("from");
  const to = params.get("to");
  const search = params.get("search")?.trim();

  if (formType) query = query.eq("form_type", formType);
  if (notificationStatus && ALLOWED_NOTIFICATION_STATUSES.has(notificationStatus)) {
    query = query.eq("notification_status", notificationStatus);
  }
  if (source) query = query.eq("utm_source", source);
  if (campaign) query = query.eq("utm_campaign", campaign);
  if (read === "read") query = query.eq("is_read", true);
  if (read === "unread") query = query.eq("is_read", false);
  if (followUp) query = query.eq("follow_up_status", followUp);
  if (from) query = query.gte("submitted_at", from);
  if (to) query = query.lte("submitted_at", `${to}T23:59:59.999Z`);
  if (search) {
    const escaped = search.replace(/[,%()]/g, " ");
    query = query.or(
      `contact_name.ilike.%${escaped}%,contact_email.ilike.%${escaped}%,organization.ilike.%${escaped}%,submission_id.eq.${escaped}`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("form submissions read failed", { code: error.code });
    return NextResponse.json({ error: "Unable to load submissions." }, { status: 500 });
  }
  return NextResponse.json({ submissions: data ?? [], count: count ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const adminUser = await requireAdminRole(["admin", "operations"]);
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (parsed.data.action === "retry") {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("form_notification_deliveries")
      .update({
        status: "pending",
        attempt_count: 0,
        next_attempt_at: now,
        claimed_at: null,
        last_error: null,
        updated_at: now,
      })
      .eq("form_submission_id", parsed.data.submissionId)
      .neq("status", "sent");
    if (error) {
      console.error("notification retry queue failed", { code: error.code });
      return NextResponse.json({ error: "Unable to queue retry." }, { status: 500 });
    }
    await admin
      .from("form_submissions")
      .update({
        notification_status: "retrying",
        last_error: null,
        updated_at: now,
      })
      .eq("id", parsed.data.submissionId);
    return NextResponse.json({ ok: true, queued: true });
  }

  const update =
    parsed.data.action === "mark_read"
      ? { is_read: parsed.data.isRead, updated_at: new Date().toISOString() }
      : {
          follow_up_status: parsed.data.status,
          assigned_owner: parsed.data.assignedOwner ?? null,
          updated_at: new Date().toISOString(),
        };
  const { error } = await admin
    .from("form_submissions")
    .update(update)
    .eq("id", parsed.data.submissionId);
  if (error) {
    console.error("form submission update failed", { code: error.code });
    return NextResponse.json({ error: "Unable to update submission." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
