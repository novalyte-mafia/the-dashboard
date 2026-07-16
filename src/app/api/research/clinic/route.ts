import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/providers/firecrawl";

const schema = z.object({ clinicId: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { clinicId } = schema.parse(await req.json());
    const clinic = await db.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return NextResponse.json({ error: "Clinic not found." }, { status: 404 });
    if (!clinic.website) return NextResponse.json({ error: "This clinic has no website to research." }, { status: 400 });
    const website = new URL(clinic.website).toString();
    const data = await scrapeWebsite(website);
    return NextResponse.json({ research: { clinicId, url: website, title: data.metadata?.title ?? clinic.name, markdown: String(data.markdown ?? "").slice(0, 12000) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research request failed." }, { status: 502 });
  }
}
