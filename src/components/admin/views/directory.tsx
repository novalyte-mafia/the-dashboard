"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, EmptyState, DirectoryStageBadge } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Globe2, CheckCircle2, XCircle, Clock, ExternalLink, Building2 } from "lucide-react";
import { formatDate, fullName } from "@/lib/format";
import { DIRECTORY_STAGES } from "@/lib/constants";
import { toast } from "sonner";

interface DirProfile {
  id: string;
  listingStatus: string;
  claimStatus: string;
  verificationStatus: string;
  profileCompleteness: number;
  servicesCompleted: boolean;
  providersCompleted: boolean;
  locationCompleted: boolean;
  hoursCompleted: boolean;
  pricingCompleted: boolean;
  imagesCompleted: boolean;
  bookingLinkCompleted: boolean;
  publicationStatus: string;
  lastReviewedAt: string | null;
  clinic: { id: string; name: string; city: string | null; state: string | null; primaryPhone: string | null; website: string | null; services: { name: string; slug: string }[] };
  reviewedBy: { firstName: string; lastName: string } | null;
}

export function DirectoryView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [profiles, setProfiles] = useState<DirProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = stage ? `?stage=${stage}` : "";
    fetch(`/api/directory${params}`)
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => toast.error("Failed to load directory"))
      .finally(() => setLoading(false));
  }, [stage, refreshKey]);

  async function updateStatus(id: string, listingStatus: string) {
    const res = await fetch(`/api/directory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingStatus }),
    });
    if (res.ok) { toast.success(`Status → ${listingStatus}`); refresh(); }
    else toast.error("Failed to update");
  }

  async function toggleField(id: string, field: string, value: boolean) {
    const res = await fetch(`/api/directory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) refresh();
    else toast.error("Failed to update");
  }

  return (
    <div>
      <PageHeader
        title="Directory Operations"
        description="Manage clinic listings for novalyte.io/directory"
        action={
          <Select value={stage} onValueChange={(v) => setStage(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All stages" /></SelectTrigger>
            <SelectContent><SelectItem value="__all">All stages</SelectItem>{DIRECTORY_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {loading ? (
        <LoadingState label="Loading directory…" />
      ) : profiles.length === 0 ? (
        <EmptyState icon={Globe2} title="No directory profiles" description="Profiles are created when clinics enter the directory stage." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {profiles.map((p) => (
            <Card key={p.id} className="p-4 gap-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <button onClick={() => openClinic(p.clinic.id)} className="flex items-center gap-2 hover:text-primary text-left min-w-0">
                  <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="size-4 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.clinic.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{[p.clinic.city, p.clinic.state].filter(Boolean).join(", ")}</p>
                  </div>
                </button>
                <DirectoryStageBadge stage={p.listingStatus} />
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Completeness</span>
                  <span className="font-medium tabular-nums">{p.profileCompleteness}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${p.profileCompleteness}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1 mb-3">
                {[["SVC", p.servicesCompleted], ["PRV", p.providersCompleted], ["LOC", p.locationCompleted], ["HRS", p.hoursCompleted], ["PRC", p.pricingCompleted], ["IMG", p.imagesCompleted], ["BOOK", p.bookingLinkCompleted]].map(([label, done]) => (
                  <button
                    key={label as string}
                    onClick={() => toggleField(p.id, label === "SVC" ? "servicesCompleted" : label === "PRV" ? "providersCompleted" : label === "LOC" ? "locationCompleted" : label === "HRS" ? "hoursCompleted" : label === "PRC" ? "pricingCompleted" : label === "IMG" ? "imagesCompleted" : "bookingLinkCompleted", !done)}
                    className={`text-[10px] rounded px-1 py-1 border font-medium transition-colors ${done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border hover:bg-accent"}`}
                    title={label as string}
                  >
                    {done ? <CheckCircle2 className="size-3 inline mr-0.5" /> : <XCircle className="size-3 inline mr-0.5 opacity-40" />}{label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                <Badge variant="secondary" className="capitalize">{p.claimStatus}</Badge>
                <Badge variant="outline" className="capitalize">{p.verificationStatus}</Badge>
                <Badge variant="outline" className="capitalize">{p.publicationStatus}</Badge>
                {p.lastReviewedAt && <span className="flex items-center gap-1"><Clock className="size-3" />{formatDate(p.lastReviewedAt)}</span>}
              </div>

              <div className="flex items-center gap-1.5 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => openClinic(p.clinic.id)}><ExternalLink className="size-3.5" /> Open Clinic</Button>
                <div className="flex-1" />
                <Select value={p.listingStatus} onValueChange={(v) => updateStatus(p.id, v)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{DIRECTORY_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
