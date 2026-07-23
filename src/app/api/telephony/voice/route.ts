import { NextRequest, NextResponse } from "next/server";

/**
 * Telnyx TeXML voice webhook.
 * Bridges an inbound/control leg to the destination number using the configured
 * TELNYX_PHONE_NUMBER as caller ID. Never falls back to a hardcoded number.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const to = (
      formData.get("To") ||
      formData.get("to") ||
      formData.get("destination_number") ||
      formData.get("DestinationNumber")
    ) as string;

    const callerId = process.env.TELNYX_PHONE_NUMBER?.trim();

    if (!to || !callerId) {
      console.error("TeXML reject: missing destination or TELNYX_PHONE_NUMBER", {
        hasTo: Boolean(to),
        hasCallerId: Boolean(callerId),
      });
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>`,
        { headers: { "Content-Type": "application/xml" } },
      );
    }

    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial caller_id="${callerId}">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    return new NextResponse(texml, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (error) {
    console.error("Telnyx TeXML Voice webhook error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>`,
      { headers: { "Content-Type": "application/xml" } },
    );
  }
}
export const dynamic = "force-dynamic";
