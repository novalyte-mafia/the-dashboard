"use client";

import { useEffect, useState } from "react";
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

interface ClinicOption { id: string; name: string; }
interface ContactOption { id: string; firstName: string; lastName: string; isDecisionMaker: boolean; }

export function LogCallDialog({
  open,
  onOpenChange,
  presetClinicId,
  presetContactId,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetClinicId?: string;
  presetContactId?: string;
  onLogged?: (clinicId: string) => void;
}) {
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [clinicId, setClinicId] = useState<string>(presetClinicId ?? "");
  const [contactId, setContactId] = useState<string>(presetContactId ?? "");
  const [outcome, setOutcome] = useState<string>("no_answer");
  const [interestLevel, setInterestLevel] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpType, setFollowUpType] = useState("phone_call");
  const [doNotCall, setDoNotCall] = useState(false);
  const [invalidNumber, setInvalidNumber] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load clinic list when no preset
  useEffect(() => {
    if (open && !presetClinicId) {
      fetch("/api/clinics?pageSize=100").then((r) => r.json()).then((d) => setClinics(d.clinics ?? [])).catch(() => {});
    }
  }, [open, presetClinicId]);

  // Load contacts when clinic changes
  useEffect(() => {
    const target = presetClinicId ?? clinicId;
    if (open && target) {
      fetch(`/api/clinics/${target}`).then((r) => r.json()).then((d) => {
        setContacts(d.clinic?.contacts ?? []);
        setClinicId(target);
      }).catch(() => {});
    }
  }, [open, presetClinicId, clinicId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setOutcome("no_answer");
      setInterestLevel("unknown");
      setNotes("");
      setNextAction("");
      setNextActionAt("");
      setFollowUpRequired(false);
      setDoNotCall(false);
      setInvalidNumber(false);
      setContactId(presetContactId ?? "");
    }
  }, [open, presetContactId]);

  const outcomeConfig = CALL_OUTCOMES.find((o) => o.id === outcome);

  async function handleSave() {
    const target = presetClinicId ?? clinicId;
    if (!target) {
      toast.error("Please select a clinic.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clinics/${target}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contactId || null,
          outcome,
          answered: outcomeConfig?.connected ?? false,
          decisionMakerReached: outcome === "interested" || outcome === "meeting_booked" || outcome === "call_back_requested" || outcome === "information_requested",
          interestLevel,
          notes,
          nextAction: nextAction || undefined,
          nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : undefined,
          followUpRequired,
          followUpType,
          doNotCall,
          invalidNumber,
          durationSec: outcomeConfig?.connected ? 300 : 0,
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
            Log Call
          </DialogTitle>
          <DialogDescription>Record a call attempt and its outcome.</DialogDescription>
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

          <div className="space-y-2">
            <Label>Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
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
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed? Objections? Next steps?" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Next Action</Label>
              <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Send info packet" />
            </div>
            <div className="space-y-2">
              <Label>Next Action Date</Label>
              <Input type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
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
          <Button onClick={handleSave} disabled={saving || !clinicId}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
            Save Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
