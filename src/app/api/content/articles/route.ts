import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await getSupabaseAdmin().from("Article").select("*").order("updatedAt", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Unable to load articles." }, { status: 502 });
  return NextResponse.json({ articles: (data ?? []).map((a: any) => ({
    id: a.id, title: a.title, slug: a.slug, category: a.category ?? "Uncategorized", excerpt: a.excerpt ?? "",
    status: a.status ?? (a.publishedAt ? "published" : "draft"), authorName: a.authorName ?? "Novalyte Editorial",
    primaryKeyword: a.primaryKeyword ?? undefined, views: Number(a.views ?? 0), seoScore: a.seoScore ?? undefined,
    publishDate: a.publishedAt ?? a.publishDate ?? undefined, updatedAt: a.updatedAt, dataSource: "live",
  })) });
}
