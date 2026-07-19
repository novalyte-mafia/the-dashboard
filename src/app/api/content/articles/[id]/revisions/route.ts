import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import {
  VersionConflictError,
  computeAdvisorySeoScore,
  listRevisions,
  restoreRevision,
} from "@/lib/content/article-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const revisions = await listRevisions(id);
    return NextResponse.json({ revisions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load revisions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

const restoreSchema = z.object({
  revisionId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = restoreSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const article = await restoreRevision(id, parsed.data.revisionId, admin.id);
    const seo = computeAdvisorySeoScore(article);
    return NextResponse.json({ article, seo });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json(
        { error: error.message, article: error.current, conflict: true },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unable to restore revision.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
