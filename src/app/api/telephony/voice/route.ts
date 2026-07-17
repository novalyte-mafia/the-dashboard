import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    // Support Telnyx / Twilio / generic form-url fields
    const to = (
      formData.get("To") || 
      formData.get("to") || 
      formData.get("destination_number") || 
      formData.get("DestinationNumber")
    ) as string;

    const callerId = process.env.TELNYX_PHONE_NUMBER;

    if (!to) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>`,
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    // Telnyx TeXML syntax uses caller_id (with underscore)
    const texml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial caller_id="${callerId || "+16017168585"}">
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
      { headers: { "Content-Type": "application/xml" } }
    );
  }
}
export const dynamic = "force-dynamic";
