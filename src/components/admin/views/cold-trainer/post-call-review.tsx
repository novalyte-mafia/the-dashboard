"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CALL_OUTCOMES } from "@/lib/constants";
import type { PostCallReview } from "@/lib/cold-trainer/types";

export function PostCallReview({
  open,
  review,
  onChange,
  onClose,
  onSaveNote,
  onScheduleFollowUp,
  onCreateContact,
  onUpdateClinic,
  onStartAnother,
  saving,
  loading,
  isSeed,
  practice,
}: {
  open: boolean;
  review: PostCallReview | null;
  onChange: (next: PostCallReview) => void;
  onClose: () => void;
  onSaveNote: () => void;
  onScheduleFollowUp: () => void;
  onCreateContact: () => void;
  onUpdateClinic: () => void;
  onStartAnother: () => void;
  saving: boolean;
  loading?: boolean;
  isSeed: boolean;
  practice: boolean;
}) {
  const set = (patch: Partial<PostCallReview>) => {
    if (!review) return;
    onChange({ ...review, ...patch });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Post-call review</DialogTitle>
          <DialogDescription>
            Coach feedback is generated from the transcript. Edit before saving. No numeric grade.
            {practice ? " Practice session — a live call note is only written if you save." : ""}
            {isSeed ? " Seed clinic cannot write to a live clinic record until you open a real clinic." : ""}
          </DialogDescription>
        </DialogHeader>
        {loading || !review ? (
          <p className="py-8 text-sm text-muted-foreground">Generating coach feedback from this call…</p>
        ) : (
          <>
            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="font-semibold text-teal-800">Coach feedback</p>
                <Badge variant="outline" className="border-teal-200 text-teal-800">
                  {review.scorecard.source === "gemini" || review.scorecard.source === "glm" ? "Model" : "Fallback"}
                </Badge>
              </div>
              <p>{review.scorecard.coachSummary}</p>
              <p className="mt-2"><span className="text-muted-foreground">What went well: </span>{review.scorecard.whatWentWell}</p>
              <p className="mt-1"><span className="text-muted-foreground">One improvement: </span>{review.scorecard.oneImprovement}</p>
              <p className="mt-1"><span className="text-muted-foreground">Shorter phrase: </span>{review.scorecard.shorterPhrase}</p>
              <p className="mt-1"><span className="text-muted-foreground">Next-call opening: </span>{review.scorecard.nextCallOpening}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Outcome">
                <Select value={review.outcome} onValueChange={(v) => set({ outcome: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CALL_OUTCOMES.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Decision-maker status">
                <Input value={review.decisionMakerStatus} onChange={(e) => set({ decisionMakerStatus: e.target.value })} />
              </Field>
              <Field label="Contact name">
                <Input value={review.contactName} onChange={(e) => set({ contactName: e.target.value })} />
              </Field>
              <Field label="Role">
                <Input value={review.contactRole} onChange={(e) => set({ contactRole: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={review.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
              </Field>
              <Field label="Permissions">
                <Input value={review.permissions} onChange={(e) => set({ permissions: e.target.value })} />
              </Field>
              <Field label="Verified details" className="sm:col-span-2">
                <Textarea value={review.verifiedDetails} onChange={(e) => set({ verifiedDetails: e.target.value })} rows={2} />
              </Field>
              <Field label="Objections">
                <Input value={review.objections} onChange={(e) => set({ objections: e.target.value })} />
              </Field>
              <Field label="Promised follow-up">
                <Input value={review.promisedFollowUp} onChange={(e) => set({ promisedFollowUp: e.target.value })} />
              </Field>
              <Field label="Next action" className="sm:col-span-2">
                <Input value={review.nextAction} onChange={(e) => set({ nextAction: e.target.value })} />
              </Field>
              <Field label="Follow-up date">
                <Input type="date" value={review.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} />
              </Field>
              <Field label="Follow-up notes">
                <Input value={review.followUpNotes} onChange={(e) => set({ followUpNotes: e.target.value })} />
              </Field>
              <Field label="Call notes" className="sm:col-span-2">
                <Textarea value={review.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} />
              </Field>
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-start">
              <Button onClick={onSaveNote} disabled={saving || isSeed}>Save Call Note</Button>
              <Button variant="outline" onClick={onScheduleFollowUp} disabled={saving || isSeed || !review.followUpDate}>Schedule Follow-Up</Button>
              <Button variant="outline" onClick={onCreateContact} disabled={saving || isSeed || !review.contactName}>Create Contact</Button>
              <Button variant="outline" onClick={onUpdateClinic} disabled={saving || isSeed}>Update Clinic</Button>
              <Button variant="secondary" onClick={onStartAnother}>Start Another Call</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
