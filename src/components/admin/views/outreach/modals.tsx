"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AD_SIGNAL_STATUSES,
  CONTACT_CHANNEL_TYPES,
  CONTACT_VERIFICATION_STATUSES,
  PAGE_TYPES,
  RESEARCH_CONFIDENCES,
  SOURCE_TYPES,
  VERTICALS,
  type AdSignalStatus,
  type ContactChannelType,
  type ContactVerificationStatus,
  type EvidenceType,
  type PageType,
  type ResearchConfidence,
  type SourceType,
  type Vertical,
} from "@/lib/outreach/types";
import { AD_SIGNAL_LABELS, CHANNEL_LABELS, CONFIDENCE_LABELS, SOURCE_BADGES, VERIFICATION_LABELS, VERTICAL_LABELS } from "@/lib/outreach/labels";
import { Field } from "./shared";

const INPUT = "h-9 text-sm";

export function AddProspectModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [clinicName, setClinicName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("US");
  const [vertical, setVertical] = useState<Vertical>("mens_health");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSubmit({
        clinicName,
        websiteUrl: websiteUrl || null,
        publicBusinessProfileUrl: profileUrl || null,
        city: city || null,
        stateOrRegion: state || null,
        country,
        vertical,
        notes: notes || null,
        sourceType: "MANUAL",
      });
      setClinicName("");
      setWebsiteUrl("");
      setProfileUrl("");
      setCity("");
      setState("");
      setNotes("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Prospect</DialogTitle>
          <DialogDescription>Create a clinic prospect for public-source research. No messages are sent.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Clinic name">
            <Input className={INPUT} value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
          </Field>
          <Field label="Website URL">
            <Input className={INPUT} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Public business profile URL">
            <Input className={INPUT} value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="https://" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City"><Input className={INPUT} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            <Field label="State"><Input className={INPUT} value={state} onChange={(e) => setState(e.target.value)} /></Field>
            <Field label="Country"><Input className={INPUT} value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
          </div>
          <Field label="Vertical">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={vertical} onChange={(e) => setVertical(e.target.value as Vertical)}>
              {VERTICALS.map((item) => <option key={item} value={item}>{VERTICAL_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !clinicName.trim()}>{busy ? "Saving…" : "Create prospect"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImportListModal({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: Record<string, unknown>[]) => Promise<void>;
}) {
  const [csv, setCsv] = useState("clinicName,websiteUrl,city,state,vertical\n");
  const [busy, setBusy] = useState(false);

  async function save() {
    const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = lines.shift()?.split(",").map((h) => h.trim()) ?? [];
    const rows = lines.map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const rec: Record<string, string> = {};
      header.forEach((key, i) => { rec[key] = cells[i] ?? ""; });
      return {
        clinicName: rec.clinicName,
        websiteUrl: rec.websiteUrl || null,
        city: rec.city || null,
        stateOrRegion: rec.state || rec.stateOrRegion || null,
        vertical: rec.vertical || "mens_health",
        sourceType: "IMPORT",
      };
    }).filter((row) => row.clinicName);
    setBusy(true);
    try {
      await onImport(rows);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import List</DialogTitle>
          <DialogDescription>CSV import of clinic names and public URLs. Does not send messages or submit forms.</DialogDescription>
        </DialogHeader>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={10} className="font-mono text-xs" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? "Importing…" : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdvertisingEvidenceModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("MANUAL");
  const [sourceUrl, setSourceUrl] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [signalStatus, setSignalStatus] = useState<AdSignalStatus>("ACTIVE_OBSERVED");
  const [serviceCategory, setServiceCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState<ResearchConfidence>("NEEDS_REVIEW");
  const [capturedBy, setCapturedBy] = useState("operator");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSubmit({
        evidenceType: "ADVERTISING_RECORD" satisfies EvidenceType,
        sourceType,
        sourceUrl,
        sourceTitle: advertiserName,
        excerpt: summary,
        observedAt: observedAt ? new Date(observedAt).toISOString() : undefined,
        confidence,
        capturedBy,
        structuredData: { advertiserName, signalStatus, serviceCategory, notes, capturedBy },
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Advertising Evidence</DialogTitle>
          <DialogDescription>Record a publicly available advertising source URL. Live ad libraries are not queried in this phase.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Source type">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
              {SOURCE_TYPES.filter((s) => s !== "DEMO").map((item) => <option key={item} value={item}>{SOURCE_BADGES[item]}</option>)}
            </select>
          </Field>
          <Field label="Source URL"><Input className={INPUT} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" /></Field>
          <Field label="Advertiser / page name"><Input className={INPUT} value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} /></Field>
          <Field label="Date observed"><Input className={INPUT} type="date" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} /></Field>
          <Field label="Advertising signal">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={signalStatus} onChange={(e) => setSignalStatus(e.target.value as AdSignalStatus)}>
              {AD_SIGNAL_STATUSES.map((item) => <option key={item} value={item}>{AD_SIGNAL_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Service category"><Input className={INPUT} value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} /></Field>
          <Field label="Summary"><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          <Field label="Confidence">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={confidence} onChange={(e) => setConfidence(e.target.value as ResearchConfidence)}>
              {RESEARCH_CONFIDENCES.map((item) => <option key={item} value={item}>{CONFIDENCE_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Captured by"><Input className={INPUT} value={capturedBy} onChange={(e) => setCapturedBy(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !sourceUrl.trim()}>{busy ? "Saving…" : "Save evidence"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WebsiteResearchModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [pageUrl, setPageUrl] = useState("");
  const [pageType, setPageType] = useState<PageType>("CONTACT");
  const [pageTitle, setPageTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [keyFacts, setKeyFacts] = useState("");
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState<ResearchConfidence>("NEEDS_REVIEW");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSubmit({
        evidenceType: pageType === "CONTACT" ? "CONTACT_PAGE" : "WEBSITE_PAGE",
        sourceType: "MANUAL",
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        excerpt,
        confidence,
        capturedAt: new Date().toISOString(),
        structuredData: {
          pageType,
          keyFacts: keyFacts.split("\n").map((line) => line.trim()).filter(Boolean),
          notes,
          fetchStatus: "manual",
        },
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add website research</DialogTitle>
          <DialogDescription>Research connector is not configured. Add a public page manually. No live crawl is run.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Page URL"><Input className={INPUT} value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="https://" /></Field>
          <Field label="Page type">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={pageType} onChange={(e) => setPageType(e.target.value as PageType)}>
              {PAGE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Page title"><Input className={INPUT} value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} /></Field>
          <Field label="Visible text excerpt"><Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={4} /></Field>
          <Field label="Key facts (one per line)"><Textarea value={keyFacts} onChange={(e) => setKeyFacts(e.target.value)} rows={3} /></Field>
          <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          <Field label="Confidence">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={confidence} onChange={(e) => setConfidence(e.target.value as ResearchConfidence)}>
              {RESEARCH_CONFIDENCES.map((item) => <option key={item} value={item}>{CONFIDENCE_LABELS[item]}</option>)}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !pageUrl.trim()}>{busy ? "Saving…" : "Save page"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactRouteModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [channelType, setChannelType] = useState<ContactChannelType>("PUBLISHED_EMAIL");
  const [value, setValue] = useState("");
  const [isPubliclyPublished, setPublic] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [verificationStatus, setVerification] = useState<ContactVerificationStatus>("UNVERIFIED");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [doNotContact, setDnc] = useState(false);
  const [isManualRecord, setManual] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSubmit({
        channelType,
        value: channelType === "NONE_FOUND" ? "No public business contact route found" : value,
        isPubliclyPublished,
        sourceUrl: sourceUrl || null,
        sourceContext,
        verificationStatus: doNotContact ? "DO_NOT_CONTACT" : verificationStatus,
        verificationNotes,
        capturedAt: capturedAt ? new Date(capturedAt).toISOString() : undefined,
        isDoNotContact: doNotContact,
        isManualRecord,
        suppressionReason: doNotContact ? notes || "Do not contact" : null,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add contact route</DialogTitle>
          <DialogDescription>Only publicly published business-facing contact methods. This does not send messages or submit forms.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Channel type">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={channelType} onChange={(e) => setChannelType(e.target.value as ContactChannelType)}>
              {CONTACT_CHANNEL_TYPES.map((item) => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}
            </select>
          </Field>
          {channelType !== "NONE_FOUND" ? (
            <Field label="Value">
              <Input className={INPUT} value={value} onChange={(e) => setValue(e.target.value)} placeholder="info@example.com or https://" />
            </Field>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPubliclyPublished} onChange={(e) => setPublic(e.target.checked)} />
            Publicly published
          </label>
          <Field label="Source URL">
            <Input className={INPUT} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isManualRecord} onChange={(e) => setManual(e.target.checked)} />
            Manual operator record (source URL optional)
          </label>
          <Field label="Source context"><Textarea value={sourceContext} onChange={(e) => setSourceContext(e.target.value)} rows={2} /></Field>
          <Field label="Verification status">
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={verificationStatus} onChange={(e) => setVerification(e.target.value as ContactVerificationStatus)}>
              {CONTACT_VERIFICATION_STATUSES.map((item) => <option key={item} value={item}>{VERIFICATION_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Verification notes"><Textarea value={verificationNotes} onChange={(e) => setVerificationNotes(e.target.value)} rows={2} /></Field>
          <Field label="Date captured"><Input className={INPUT} type="datetime-local" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={doNotContact} onChange={(e) => setDnc(e.target.checked)} />
            Do not contact
          </label>
          <Field label="Internal notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save route"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditProspectModal({
  open,
  onOpenChange,
  clinicName,
  websiteUrl,
  notes,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicName: string;
  websiteUrl: string;
  notes: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(clinicName);
  const [site, setSite] = useState(websiteUrl);
  const [note, setNote] = useState(notes);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSubmit({ clinicName: name, websiteUrl: site || null, notes: note || null });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit prospect</DialogTitle>
          <DialogDescription>Update public clinic details. No outreach is sent.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Clinic name"><Input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Website URL"><Input className={INPUT} value={site} onChange={(e) => setSite(e.target.value)} /></Field>
          <Field label="Notes"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
