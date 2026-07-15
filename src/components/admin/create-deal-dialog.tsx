"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEAL_STAGES } from "@/lib/constants";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface ClinicOption { id: string; name: string; }

export function CreateDealDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [offer, setOffer] = useState("");
  const [stage, setStage] = useState("opportunity_identified");
  const [monthly, setMonthly] = useState("");
  const [setup, setSetup] = useState("");
  const [total, setTotal] = useState("");
  const [probability, setProbability] = useState("20");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) fetch("/api/clinics?pageSize=100").then((r) => r.json()).then((d) => setClinics(d.clinics ?? [])).catch(() => {}); }, [open]);
  useEffect(() => { if (!open) { setName(""); setClinicId(""); setOffer(""); setStage("opportunity_identified"); setMonthly(""); setSetup(""); setTotal(""); setProbability("20"); setCloseDate(""); setNotes(""); } }, [open]);

  async function handleSave() {
    if (!name.trim()) { toast.error("Deal name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, clinicId: clinicId || null, offer: offer || null, stage,
          estimatedMonthlyValue: Number(monthly) || 0, setupFee: Number(setup) || 0,
          estimatedTotalValue: Number(total) || 0, probability: Number(probability) || 0,
          expectedCloseDate: closeDate ? new Date(closeDate).toISOString() : null, notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create deal");
      toast.success("Deal created");
      onOpenChange(false);
      onCreated?.();
    } catch { toast.error("Failed to create deal"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto nv-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="size-4 text-primary" /> New Deal</DialogTitle>
          <DialogDescription>Track a revenue opportunity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2"><Label>Deal Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summit Vitality — Annual Partnership" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Clinic</Label><Select value={clinicId} onValueChange={setClinicId}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent className="max-h-60">{clinics.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Stage</Label><Select value={stage} onValueChange={setStage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Offer</Label><Input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. Directory Premium + Lead Gen" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Monthly $</Label><Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
            <div className="space-y-2"><Label>Setup $</Label><Input type="number" value={setup} onChange={(e) => setSetup(e.target.value)} /></div>
            <div className="space-y-2"><Label>Total $</Label><Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Probability %</Label><Input type="number" value={probability} onChange={(e) => setProbability(e.target.value)} min={0} max={100} /></div>
            <div className="space-y-2"><Label>Expected Close</Label><Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create Deal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
