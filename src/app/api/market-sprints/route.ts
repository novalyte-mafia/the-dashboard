import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapDbSprint } from "@/lib/market-sprints";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("market_sprints")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("market_sprints list", error);
    return NextResponse.json({ error: "Failed to load market sprints" }, { status: 500 });
  }

  const markets = (data ?? []).map((row) => mapDbSprint(row as any));
  const defaultMarket = markets.find((m) => m.isDefault) ?? markets[0] ?? null;

  return NextResponse.json({ markets, defaultMarket });
}
