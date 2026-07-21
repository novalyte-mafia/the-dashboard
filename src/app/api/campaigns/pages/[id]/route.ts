import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { getPage, updatePage } from "@/lib/campaigns/store";

const patchSchema = z.object({
  publicTitle: z.string().max(300).nullable().optional(),
  internalTitle: z.string().max(300).nullable().optional(),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  hero: z.record(z.string(), z.unknown()).optional(),
  ctaPrimary: z.string().max(120).nullable().optional(),
  ctaSecondary: z.string().max(120).nullable().optional(),
  formConfig: z.record(z.string(), z.unknown()).optional(),
  routingConfig: z.record(z.string(), z.unknown()).optional(),
  indexingPolicy: z
    .enum(["index_follow", "noindex_follow", "noindex_nofollow", "draft_inaccessible"])
    .optional(),
  status: z
    .enum([
      "draft",
      "generating",
      "generation_failed",
      "needs_review",
      "changes_requested",
      "approved",
      "scheduled",
      "published",
      "paused",
      "archived",
      "redirected",
    ])
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const page = await getPage(id);
    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }
    return NextResponse.json({ page });
  } catch (error) {
    console.error("campaign page get", error);
    const message = error instanceof Error ? error.message : "Unable to load page.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const page = await updatePage(id, parsed.data);
    await logActivity({
      adminId: admin.id,
      entityType: "cs_page",
      entityId: page.id,
      action: "campaign_page_updated",
      summary: `Updated page ${page.path}`,
    }).catch(() => undefined);
    return NextResponse.json({ page });
  } catch (error) {
    console.error("campaign page patch", error);
    const message = error instanceof Error ? error.message : "Unable to update page.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
