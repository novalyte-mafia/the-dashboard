"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FOLLOWUP_TYPES, PRIORITIES } from "@/lib/constants";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface ClinicOption { id: string; name: string; }

export function CreateFollowUpDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const [title, setTitle] = useState("");
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [taskType, setTaskType] = useState("phone_call");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) fetch("/api/clinics?pageSize=100").then((r) => r.json()).then((d) => setClinics(d.clinics ?? [])).catch(() => {});
  }, [open]);

  useEffect(() => { if (!open) { setTitle(""); setClinicId(""); setTaskType("phone_call"); setPriority("normal"); setDueDate(""); setNotes(""); } }, [open]);

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, clinicId: clinicId || null, taskType, priority, dueDate: dueDate ? new Date(dueDate).toISOString() : null, notes: notes || null }),
      });
      if (!res.ok) throw new Error("Failed to create follow-up");
      toast.success("Follow-up created");
      onOpenChange(false);
      onCreated?.();
    } catch { toast.error("Failed to create follow-up"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="size-4 text-primary" /> New Follow-Up</DialogTitle>
          <DialogDescription>Create a task or next action.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send proposal to Marcus" /></div>
          <div className="space-y-2">
            <Label>Clinic</Label>
            <Select value={clinicId} onValueChange={setClinicId}>
              <SelectTrigger><SelectValue placeholder="Optional — link a clinic" /></SelectTrigger>
              <SelectContent className="max-h-60">{clinics.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Type</Label><Select value={taskType} onValueChange={setTaskType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FOLLOWUP_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Priority</Label><Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
