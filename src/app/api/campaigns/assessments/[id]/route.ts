import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity } from "@/lib/data";
import {
  createDraftAssessmentVersion,
  getAssessmentTemplate,
  publishAssessmentVersion,
  updateDraftAssessmentVersion,
} from "@/lib/campaigns/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const template = await getAssessmentTemplate(id);
    if (!template) {
      return NextResponse.json({ error: "Assessment template not found." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error("campaign assessment get", error);
    const message = error instanceof Error ? error.message : "Unable to load assessment.";
    if (/does not exist|relation/i.test(message)) {
      return NextResponse.json({ error: "Assessment templates not configured." }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

const draftSchema = z.object({
  action: z.literal("create_draft"),
  fromVersionId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  action: z.literal("update_draft"),
  versionId: z.string().uuid(),
  questions: z.array(z.record(z.string(), z.unknown())).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  consent_copy: z.string().nullable().optional(),
  completion_message: z.string().nullable().optional(),
  next_action: z.string().optional(),
});

const publishSchema = z.object({
  action: z.literal("publish"),
  versionId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const draft = draftSchema.safeParse(body);
    if (draft.success) {
      const version = await createDraftAssessmentVersion(id, draft.data.fromVersionId);
      await logActivity({
        adminId: admin.id,
        action: "assessment_draft_created",
        entityType: "cs_assessment_template",
        entityId: id,
        summary: `Created assessment draft version ${version.version}`,
        metadata: { versionId: version.id, version: version.version },
      });
      return NextResponse.json({ version });
    }

    const update = updateSchema.safeParse(body);
    if (update.success) {
      const version = await updateDraftAssessmentVersion(update.data.versionId, {
        questions: update.data.questions,
        config: update.data.config,
        consent_copy: update.data.consent_copy,
        completion_message: update.data.completion_message,
        next_action: update.data.next_action,
      });
      await logActivity({
        adminId: admin.id,
        action: "assessment_draft_updated",
        entityType: "cs_assessment_template_version",
        entityId: version.id,
        summary: `Updated assessment draft ${version.version}`,
        metadata: { templateId: id },
      });
      return NextResponse.json({ version });
    }

    const publish = publishSchema.safeParse(body);
    if (publish.success) {
      const version = await publishAssessmentVersion(publish.data.versionId, admin.id);
      await logActivity({
        adminId: admin.id,
        action: "assessment_version_published",
        entityType: "cs_assessment_template_version",
        entityId: version.id,
        summary: `Published assessment version ${version.version}`,
        metadata: { templateId: id, version: version.version },
      });
      return NextResponse.json({ version });
    }

    return NextResponse.json({ error: "Invalid assessment action." }, { status: 400 });
  } catch (error) {
    console.error("campaign assessment mutate", error);
    const message = error instanceof Error ? error.message : "Unable to update assessment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
