import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import { bindPageAssessment, updatePage } from "@/lib/campaigns/store";

const bindSchema = z.object({
  templateId: z.string().uuid(),
  versionId: z.string().uuid(),
  placement: z.array(z.string()).optional(),
  formConfig: z.record(z.string(), z.unknown()).optional(),
  assessmentStatus: z
    .enum(["unconfigured", "draft", "ready", "published", "invalid"])
    .optional(),
});

const jsonSchema = z.object({
  formConfig: z.record(z.string(), z.unknown()),
  placement: z.array(z.string()).optional(),
  assessmentStatus: z
    .enum(["unconfigured", "draft", "ready", "published", "invalid"])
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const bindParsed = bindSchema.safeParse(body);
  if (bindParsed.success) {
    try {
      const page = await bindPageAssessment(id, bindParsed.data);
      await logActivity({
        adminId: admin.id,
        entityType: "cs_page",
        entityId: id,
        action: "campaign_page_assessment_bound",
        summary: `Bound assessment to page ${page.path}`,
      }).catch(() => undefined);
      return NextResponse.json({ page });
    } catch (error) {
      console.error("campaign page assessment bind", error);
      const message = error instanceof Error ? error.message : "Unable to bind assessment.";
      const status = /not found/i.test(message) ? 404 : 502;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const jsonParsed = jsonSchema.safeParse(body);
  if (!jsonParsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: jsonParsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const page = await updatePage(id, {
      formConfig: jsonParsed.data.formConfig,
      assessmentPlacement: jsonParsed.data.placement,
      assessmentStatus: jsonParsed.data.assessmentStatus,
    });

    await logActivity({
      adminId: admin.id,
      entityType: "cs_page",
      entityId: id,
      action: "campaign_page_assessment_updated",
      summary: `Updated assessment config on page ${page.path}`,
    }).catch(() => undefined);

    return NextResponse.json({ page });
  } catch (error) {
    console.error("campaign page assessment json", error);
    const message = error instanceof Error ? error.message : "Unable to update assessment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
