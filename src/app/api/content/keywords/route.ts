import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { researchKeywords } from "@/lib/content/keyword-research";

export const runtime = "nodejs";

const requestSchema = z.object({
  seedKeyword: z.string().min(1).max(200),
  additionalKeywords: z.array(z.string().min(1).max(200)).max(20).optional(),
  topic: z.string().max(1000).optional(),
  locationName: z.string().min(1).max(100).optional(),
  languageCode: z.string().min(2).max(10).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * Keyword research for the Content Studio keyword panel.
 * Returns DataForSEO Labs metrics when credentials are configured, otherwise
 * labeled AI recommendations with no metrics. The `keywords` field in the
 * response is an apply-ready patch for JournalArticleV1 `keywords`.
 */
export async function POST(request: Request) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await researchKeywords(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keyword research failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
