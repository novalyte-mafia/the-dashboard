import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import {
  VersionConflictError,
  computeAdvisorySeoScore,
  duplicateArticle,
  transitionArticleStatus,
} from "@/lib/content/article-store";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("publish"),
    rowVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("unpublish"),
    rowVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("archive"),
    rowVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("review"),
    rowVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("approve"),
    rowVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("schedule"),
    scheduledFor: z.string().datetime({ offset: true }),
    rowVersion: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("duplicate"),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminRole(["admin", "operations"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.action === "duplicate") {
      const article = await duplicateArticle(id, admin.id);
      return NextResponse.json({ article }, { status: 201 });
    }

    const article = await transitionArticleStatus(id, parsed.data.action, {
      scheduledFor:
        parsed.data.action === "schedule" ? parsed.data.scheduledFor : undefined,
      rowVersion: "rowVersion" in parsed.data ? parsed.data.rowVersion : undefined,
      adminId: admin.id,
    });
    const seo = computeAdvisorySeoScore(article);
    return NextResponse.json({ article, seo });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return NextResponse.json(
        { error: error.message, article: error.current, conflict: true },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Action failed.";
    const status = /not found/i.test(message) ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
