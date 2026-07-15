import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const clinics = await db.clinic.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { legalName: { contains: q } },
        { city: { contains: q } },
        { state: { contains: q } },
        { zip: { contains: q } },
        { primaryPhone: { contains: q } },
        { generalEmail: { contains: q } },
        { website: { contains: q } },
      ],
    },
    include: { contacts: { where: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] }, take: 1 } },
    take: 12,
  });

  const results = clinics.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    state: c.state,
    primaryPhone: c.primaryPhone,
    generalEmail: c.generalEmail,
    contactName: c.contacts[0] ? `${c.contacts[0].firstName} ${c.contacts[0].lastName}`.trim() : null,
    type: "clinic" as const,
  }));
  return NextResponse.json({ results });
}
