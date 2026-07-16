import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await getSupabaseAdmin().from("MarketplaceListing").select("*").order("updatedAt", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Unable to load marketplace listings." }, { status: 502 });
  return NextResponse.json({ products: (data ?? []).map((p: any) => ({
    id: p.id, title: p.title, sku: p.slug ?? p.id, category: p.category ?? "Uncategorized", vendor: p.vendorName ?? "Unknown vendor",
    price: Number(p.price ?? 0), compareAtPrice: undefined, cost: 0, margin: 0, inventory: p.availability === "in-stock" ? 1 : 0,
    status: p.reviewStatus === "approved" ? "active" : p.reviewStatus === "rejected" ? "archived" : "draft",
    visibility: p.verified ? "public" : "hidden", rating: undefined, reviewCount: 0, dataSource: "live",
  })) });
}
