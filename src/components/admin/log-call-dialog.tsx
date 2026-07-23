"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CALL_OUTCOMES, FOLLOWUP_TYPES } from "@/lib/constants";
import { Loader2, PhoneCall } from "lucide-react";
import { toast } from "sonner";

interface ClinicOption { id: string; name: string; primaryPhone?: string | null }
interface ContactOption { id: string; firstName: string; lastName: string; isDecisionMaker: boolean }

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LogCallDialog({
  open,
  onOpenChange,
  presetClinicId,
  presetContactId,
  presetPhone,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetClinicId?: string;
  presetContactId?: string;
  presetPhone?: string | null;
  onLogged?: (clinicId: string) => void;
}) {
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [clinicId, setClinicId] = useState<string>(presetClinicId ?? "");
  const [contactId, setContactId] = useState<string>(presetContactId ?? "");
  const [outcome, setOutcome] = useState<string>("decision_maker_unavailable");
  const [interestLevel, setInterestLevel] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(true);
  const [followUpType, setFollowUpType] = useState("email");
  const [doNotCall, setDoNotCall] = useState(false);
  const [invalidNumber, setInvalidNumber] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calledAt, setCalledAt] = useState(() => toLocalInputValue(new Date()));
  const [phoneNumber, setPhoneNumber] = useState(presetPhone ?? "");
  const [personName, setPersonName] = useState("");
  const [personRole, setPersonRole] = useState("");
  const [emailProvided, setEmailProvided] = useState("");
  const [durationMin, setDurationMin] = useState("5");

  useEffect(() => {
    if (open && !presetClinicId) {
      fetch("/api/clinics?pageSize=100")
        .then((r) => r.json())
        .then((d) => setClinics(d.clinics ?? []))
        .catch(() => {});
    }
  }, [open, presetClinicId]);

  useEffect(() => {
    const target = presetClinicId ?? clinicId;
    if (open && target) {
      fetch(`/api/clinics/${target}`)
        .then((r) => r.json())
        .then((d) => {
          setContacts(d.clinic?.contacts ?? []);
          setClinicId(target);
          if (!phoneNumber) setPhoneNumber(d.clinic?.primaryPhone ?? presetPhone ?? "");
        })
        .catch(() => {});
    }
  }, [open, presetClinicId, clinicId, phoneNumber, presetPhone]);

  useEffect(() => {
    if (!open) {
      setOutcome("decision_maker_unavailable");
      setInterestLevel("unknown");
      setNotes("");
      setNextAction("");
      setNextActionAt("");
      setFollowUpRequired(true);
      setFollowUpType("email");
      setDoNotCall(false);
      setInvalidNumber(false);
      setContactId(presetContactId ?? "");
      setCalledAt(toLocalInputValue(new Date()));
      setPhoneNumber(presetPhone ?? "");
      setPersonName("");
      setPersonRole("");
      setEmailProvided("");
      setDurationMin("5");
    }
  }, [open, presetContactId, presetPhone]);

  const outcomeConfig = useMemo(() => CALL_OUTCOMES.find((o) => o.id === outcome), [outcome]);

  async function handleSave() {
    const target = presetClinicId ?? clinicId;
    if (!target) {
      toast.error("Please select a clinic.");
      return;
    }
    const started = calledAt ? new Date(calledAt) : new Date();
    const durationSec = Math.max(0, Math.round(Number(durationMin || 0) * 60));
    const ended = new Date(started.getTime() + durationSec * 1000);

    setSaving(true);
    try {
      const res = await fetch(`/api/clinics/${target}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contactId && contactId !== "none" ? contactId : null,
          outcome,
          answered: outcomeConfig?.connected ?? false,
          decisionMakerReached:
            outcome === "decision_maker_reached" ||
            outcome === "interested" ||
            outcome === "meeting_booked" ||
            outcome === "permission_granted" ||
            outcome === "email_requested" ||
            outcome === "information_provided",
          interestLevel,
          notes,
          nextAction: nextAction || undefined,
          nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
          followUpRequired: followUpRequired || Boolean(nextAction),
          followUpType,
          doNotCall,
          invalidNumber,
          durationSec,
          startedAt: started.toISOString(),
          endedAt: ended.toISOString(),
          provider: "external_cell",
          externalNumber: phoneNumber || null,
          structuredData: {
            source: "manual_external_log",
            personContacted: personName || null,
            contactRole: personRole || null,
            emailProvided: emailProvided || null,
            phoneNumber: phoneNumber || null,
          },
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to log call");
      }
      toast.success("Call logged", { description: `Outcome: ${outcomeConfig?.label ?? outcome}` });
      onOpenChange(false);
      onLogged?.(target);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log call");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto nv-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="size-4 text-primary" />
            Log External Call
          </DialogTitle>
          <DialogDescription>
            Capture a call placed from your cell phone or outside the dashboard. Takes under a minute.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!presetClinicId && (
            <div className="space-y-2">
              <Label>Clinic</Label>
              <Select value={clinicId} onValueChange={setClinicId}>
                <SelectTrigger><SelectValue placeholder="Select clinic" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {clinics.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date & time called</Label>
              <Input type="datetime-local" value={calledAt} onChange={(e) => setCalledAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" min={0} step={1} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone number dialed</Label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Person contacted</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={personRole} onChange={(e) => setPersonRole(e.target.value)} placeholder="Manager, front desk…" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email provided</Label>
            <Input type="email" value={emailProvided} onChange={(e) => setEmailProvided(e.target.value)} placeholder="manager@clinic.com" />
          </div>

          <div className="space-y-2">
            <Label>CRM contact (optional)</Label>
            <Select value={contactId || "none"} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="No specific contact" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific contact</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.isDecisionMaker ? " (DM)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {CALL_OUTCOMES.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Interest Level</Label>
            <Select value={interestLevel} onValueChange={setInterestLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Who you spoke with, what they said, manager contact, email follow-up…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Next Action</Label>
              <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Email clinic manager" />
            </div>
            <div className="space-y-2">
              <Label>Follow-up date</Label>
              <Input type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={followUpRequired} onCheckedChange={(v) => setFollowUpRequired(v === true)} />
              Create follow-up
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={doNotCall} onCheckedChange={(v) => setDoNotCall(v === true)} />
              Do not call
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={invalidNumber} onCheckedChange={(v) => setInvalidNumber(v === true)} />
              Invalid number
            </label>
          </div>

          {followUpRequired && (
            <div className="space-y-2">
              <Label>Follow-Up Type</Label>
              <Select value={followUpType} onValueChange={setFollowUpType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !(presetClinicId || clinicId)}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
            Save Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
