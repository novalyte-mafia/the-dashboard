import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).max(8000).optional(),
  category: z.string().max(100).optional(),
  approval_status: z.enum(["approved", "draft", "outdated", "rejected", "internal"]).optional(),
  external_approved: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("copilot_knowledge_entries")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }
}
