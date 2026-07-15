"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SERVICE_CATALOG, US_TIMEZONES, PIPELINE_STAGES, PRIORITIES } from "@/lib/constants";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export function AddClinicDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (clinicId: string) => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [generalEmail, setGeneralEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [clinicType, setClinicType] = useState("private_practice");
  const [telehealth, setTelehealth] = useState(false);
  const [pipelineStage, setPipelineStage] = useState("imported");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName(""); setWebsite(""); setPrimaryPhone(""); setGeneralEmail("");
      setCity(""); setState(""); setZip(""); setTimezone("America/New_York");
      setClinicType("private_practice"); setTelehealth(false);
      setPipelineStage("imported"); setPriority("normal"); setNotes(""); setServices([]);
    }
  }, [open]);

  function toggleService(slug: string) {
    setServices((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Clinic name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, website: website || null, primaryPhone: primaryPhone || null,
          generalEmail: generalEmail || null, city: city || null, state: state || null,
          zip: zip || null, timezone, clinicType, telehealth, pipelineStage, priority,
          notes: notes || null, services,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to create clinic");
      }
      const data = await res.json();
      toast.success("Clinic added", { description: name });
      onOpenChange(false);
      onCreated?.(data.clinic.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create clinic");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto nv-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="size-4 text-primary" /> Add Clinic</DialogTitle>
          <DialogDescription>Create a new clinic record in the pipeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Clinic Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summit Vitality Clinic" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>Primary Phone</Label>
              <Input value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} placeholder="(555) 555-0100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>ZIP</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>General Email</Label>
              <Input value={generalEmail} onChange={(e) => setGeneralEmail(e.target.value)} placeholder="info@…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{US_TIMEZONES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Clinic Type</Label>
              <Select value={clinicType} onValueChange={setClinicType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private_practice">Private Practice</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="franchise">Franchise</SelectItem>
                  <SelectItem value="telehealth">Telehealth</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Services</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto nv-scroll p-0.5">
              {SERVICE_CATALOG.map((s) => (
                <label key={s.slug} className="flex items-center gap-2 text-xs rounded-md border px-2 py-1.5 cursor-pointer hover:bg-accent">
                  <Checkbox checked={services.includes(s.slug)} onCheckedChange={() => toggleService(s.slug)} />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Pipeline Stage</Label>
              <Select value={pipelineStage} onValueChange={setPipelineStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">{PIPELINE_STAGES.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={telehealth} onCheckedChange={(v) => setTelehealth(v === true)} />
            Offers telehealth
          </label>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Initial notes…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create Clinic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
