"use client";

import { SectionCard } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClinicContextPayload, PrepFields } from "@/lib/cold-trainer/types";
import { formatPhone } from "@/lib/format";

export function CallPlanColumn({
  clinic,
  prep,
  onPrepChange,
}: {
  clinic: ClinicContextPayload;
  prep: PrepFields;
  onPrepChange: (next: PrepFields) => void;
}) {
  const field = (key: keyof PrepFields, label: string, rows = 2) => (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {rows === 1 ? (
        <Input
          value={prep[key]}
          onChange={(e) => onPrepChange({ ...prep, [key]: e.target.value })}
          className="h-8 text-xs"
        />
      ) : (
        <Textarea
          value={prep[key]}
          onChange={(e) => onPrepChange({ ...prep, [key]: e.target.value })}
          rows={rows}
          className="text-xs"
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Clinic" bodyClassName="space-y-2 p-4">
        <div className="text-sm font-semibold">{clinic.clinic_name}</div>
        <Fact label="Location" value={clinic.location || clinic.address || "Unverified"} />
        <Fact label="Type" value={clinic.clinic_type || "Unverified"} />
        <Fact label="Services" value={clinic.known_services || "Unknown — ask, do not invent"} />
        <Fact label="Phone" value={clinic.phone ? formatPhone(clinic.phone) : "Unknown — ask, do not invent"} />
        <Fact label="Contact" value={clinic.contact_name ? `${clinic.contact_name}${clinic.contact_role ? ` · ${clinic.contact_role}` : ""}` : "Unknown — ask, do not invent"} />
        <Fact label="Readiness" value={clinic.readiness_score || "—"} />
        <Fact label="Last / status" value={`${clinic.status}${clinic.previous_calls ? ` · ${clinic.previous_calls.split(" | ")[0]}` : ""}`} />
        <Fact label="Notes" value={clinic.notes || "—"} />
        {clinic.is_seed && (
          <p className="text-[11px] text-amber-700">Seed clinic: no phone, services, or contacts. Verify first.</p>
        )}
      </SectionCard>
      <SectionCard title="30-Second Prep" description="Who, why, one question, next step" bodyClassName="space-y-2 p-4">
        <PrepLine k="Who I am" v="Jamil, founder of Novalyte." />
        <PrepLine k="Why I am calling" v={prep.valueProposition || "Verifying the clinic’s online profile."} />
        <PrepLine k="The one question" v="Who is the best person to speak with about your online profile?" />
        <PrepLine k="Desired next step" v={prep.desiredNextStep} />
      </SectionCard>
      <SectionCard title="My prep" bodyClassName="space-y-3 p-4">
        {field("myGoal", "My goal for this call", 1)}
        {field("valueProposition", "One sentence value proposition")}
        {field("desiredNextStep", "Desired next step", 1)}
        {field("mustNotClaim", "Things I must not claim")}
        {field("notesToRemember", "Notes to remember")}
      </SectionCard>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function PrepLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="text-xs">
      <div className="font-medium text-teal-700">{k}</div>
      <div className="text-foreground">{v}</div>
    </div>
  );
}
