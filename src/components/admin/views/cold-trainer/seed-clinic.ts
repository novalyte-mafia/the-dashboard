import { PROHIBITED_CLAIMS, type ClinicContextPayload, type PrepFields } from "@/lib/cold-trainer/types";
import { DEFAULT_PREP } from "@/lib/cold-trainer/types";

export const SEED_CLINIC_ID = "seed-retreat-wellness";

export function seedClinicPayload(prep: PrepFields = DEFAULT_PREP, callGoal: ClinicContextPayload["call_goal"] = "Find decision-maker"): ClinicContextPayload {
  return {
    clinic_id: null,
    is_seed: true,
    clinic_name: "Retreat Wellness and MedSpa, PLLC",
    location: "Wenatchee, WA",
    clinic_type: "private_practice",
    phone: "",
    website: "",
    address: "123 Ohme Garden Rd #4",
    known_services: "",
    contact_name: "",
    contact_role: "",
    contact_id: null,
    email: "",
    readiness_score: "8",
    status: "Needs Research",
    directory_status: "unlisted",
    previous_calls: "No prior calls on file.",
    notes: "",
    call_goal: callGoal,
    approved_value_proposition: prep.valueProposition,
    prohibited_claims: PROHIBITED_CLAIMS,
    missing_facts: ["phone", "services", "contacts"],
  };
}
