"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CONTACT_TYPES } from "@/lib/constants";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export function AddContactDialog({
  clinicId,
  open,
  onOpenChange,
  onAdded,
}: {
  clinicId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded?: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [contactType, setContactType] = useState("general_contact");
  const [email, setEmail] = useState("");
  const [directPhone, setDirectPhone] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [isDecisionMaker, setIsDecisionMaker] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFirstName(""); setLastName(""); setTitle(""); setContactType("general_contact");
      setEmail(""); setDirectPhone(""); setMobilePhone(""); setIsDecisionMaker(false); setIsPrimary(false);
    }
  }, [open]);

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clinics/${clinicId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, title: title || null, contactType,
          email: email || null, directPhone: directPhone || null, mobilePhone: mobilePhone || null,
          isDecisionMaker, isPrimary,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to add contact");
      }
      toast.success("Contact added", { description: `${firstName} ${lastName}` });
      onOpenChange(false);
      onAdded?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto nv-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="size-4 text-primary" /> Add Contact</DialogTitle>
          <DialogDescription>Add a decision-maker or contact for this clinic.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>First Name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Last Name *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Medical Director" />
          </div>
          <div className="space-y-2">
            <Label>Contact Type</Label>
            <Select value={contactType} onValueChange={setContactType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTACT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Direct Phone</Label><Input value={directPhone} onChange={(e) => setDirectPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>Mobile Phone</Label><Input value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={isDecisionMaker} onCheckedChange={(v) => setIsDecisionMaker(v === true)} /> Decision-maker</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(v === true)} /> Primary contact</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !firstName.trim() || !lastName.trim()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Add Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
