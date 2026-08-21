import { PIPELINE_STAGES } from "@/lib/constants";
import { PROHIBITED_CLAIMS, type CallGoal, type ClinicContextPayload, type PrepFields } from "@/lib/cold-trainer/types";
import { clinicHasMissingFacts } from "@/lib/cold-trainer/guardrails";

type LooseClinic = {
  id?: string;
  name?: string;
  city?: string;
  state?: string;
  clinicType?: string;
  primaryPhone?: string;
  website?: string;
  address?: string;
  generalEmail?: string;
  services?: unknown;
  contacts?: Array<{
    id?: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    email?: string;
    isPrimary?: boolean;
    isDecisionMaker?: boolean;
    contactType?: string;
  }>;
  readinessScore?: number;
  pipelineStage?: string;
  directoryStatus?: string;
  notes?: string;
  lastContactedAt?: string;
};

type LooseCall = {
  outcome?: string;
  startedAt?: string;
  notes?: string;
  answered?: boolean;
};

function stageLabel(id?: string): string {
  return PIPELINE_STAGES.find((s) => s.id === id)?.label ?? id ?? "Unknown";
}

function servicesText(services: unknown): string {
  if (!Array.isArray(services) || services.length === 0) return "";
  return services
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "service" in item) return String((item as { service?: unknown }).service ?? "");
      if (item && typeof item === "object" && "name" in item) return String((item as { name?: unknown }).name ?? "");
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

export function mapClinicToPayload(
  clinic: LooseClinic | null,
  calls: LooseCall[],
  prep: PrepFields,
  callGoal: CallGoal,
): ClinicContextPayload | null {
  if (!clinic?.id || !clinic.name) return null;
  const contacts = clinic.contacts ?? [];
  const primary =
    contacts.find((c) => c.isPrimary) ||
    contacts.find((c) => c.isDecisionMaker) ||
    contacts[0];
  const contactName = primary ? `${primary.firstName ?? ""} ${primary.lastName ?? ""}`.trim() : "";
  const previous = calls.slice(0, 5).map((c) => {
    const when = c.startedAt ? new Date(c.startedAt).toLocaleDateString() : "unknown date";
    return `${when}: ${c.outcome ?? "logged"}${c.answered ? " (answered)" : ""}${c.notes ? ` — ${c.notes.slice(0, 80)}` : ""}`;
  });

  const payload: ClinicContextPayload = {
    clinic_id: clinic.id,
    is_seed: false,
    clinic_name: clinic.name,
    location: [clinic.city, clinic.state].filter(Boolean).join(", "),
    clinic_type: clinic.clinicType ?? "",
    phone: clinic.primaryPhone ?? "",
    website: clinic.website ?? "",
    address: clinic.address ?? "",
    known_services: servicesText(clinic.services),
    contact_name: contactName,
    contact_role: primary?.title || primary?.contactType || "",
    contact_id: primary?.id ?? null,
    email: primary?.email || clinic.generalEmail || "",
    readiness_score: String(clinic.readinessScore ?? ""),
    status: stageLabel(clinic.pipelineStage),
    directory_status: clinic.directoryStatus ?? "",
    previous_calls: previous.join(" | ") || "No prior calls on file.",
    notes: clinic.notes ?? "",
    call_goal: callGoal,
    approved_value_proposition: prep.valueProposition,
    prohibited_claims: PROHIBITED_CLAIMS,
    missing_facts: [],
  };

  if (clinicHasMissingFacts(payload)) {
    const missing: string[] = [];
    if (!payload.phone) missing.push("phone");
    if (!payload.known_services) missing.push("services");
    if (!payload.contact_name) missing.push("contacts");
    payload.missing_facts = missing;
  }
  return payload;
}
