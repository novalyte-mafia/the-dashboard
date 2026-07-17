/** Field-guide keyword fallback — shared by GLM provider and knowledge copilot. */
export function generateFieldGuideSuggestion(transcript: string) {
  const reply = transcript.toLowerCase();
  if (reply.includes("sales") || reply.includes("did not request") || reply.includes("didn't request") || reply.includes("not interested")) {
    return "That’s fair. This is not a paid sales call—the basic verified listing is free. I only need to confirm your public details and your permission to publish them.";
  }
  if (reply.includes("email") || reply.includes("send me")) {
    return "Absolutely. Before I send it, may I confirm the best email and the name of the person who manages your clinic listing?";
  }
  if (
    reply.includes("free") ||
    reply.includes("fee") ||
    reply.includes("fees") ||
    reply.includes("cost") ||
    reply.includes("price") ||
    reply.includes("charge")
  ) {
    return "Yes—the verified directory listing is completely free. I just need your permission to include your clinic profile and confirm a few public details.";
  }
  if ((reply.includes("why") || reply.includes("reason")) && (reply.includes("calling") || reply.includes("called"))) {
    return "Of course. We’re calling to verify your clinic’s public details for the Novalyte AI directory—it’s a free, permission-based listing. May I confirm a couple items to publish your verified profile?";
  }
  if (reply.includes("what is novalyte") || reply.includes("who is novalyte") || reply.includes("novolyte")) {
    return "Novalyte AI is a men’s health technology platform that helps patients find verified clinics—we’re not a medical provider. Today I’m calling about your free directory listing, not a paid contract.";
  }
  if (reply.includes("guarantee") || reply.includes("how many patients")) {
    return "We don’t guarantee a specific patient volume—the free listing helps patients find you, and optional paid acquisition is separate if you ever want to explore it.";
  }
  if (reply.includes("hipaa") || reply.includes("patient records")) {
    return "For the free listing we only need public clinic information—we don’t need access to patient records. I can follow up by email with our approved privacy overview if helpful.";
  }
  if (reply.includes("busy") || reply.includes("bad time") || reply.includes("call back")) {
    return "Of course. What day and time would be best for a two-minute verification call?";
  }
  if (reply.includes("manager") || reply.includes("owner") || reply.includes("doctor")) {
    return "Thank you. May I confirm who manages your clinic listing, or is there a better time to reach them?";
  }
  if (reply.includes("already") && (reply.includes("enough") || reply.includes("full"))) {
    return "That’s completely fine. Even if you’re booked now, the free directory helps the right patients find you later—may I confirm permission to include your verified profile?";
  }
  return "Thank you. To make sure we list the clinic accurately, may I confirm your public phone number, services, and whether you are accepting new patients?";
}
