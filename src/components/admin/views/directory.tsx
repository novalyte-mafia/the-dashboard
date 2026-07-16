"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
  ScoreBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe2, Building2, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { directoryService, clinicService } from "@/services";
import { DIRECTORY_STAGES, directoryStageLabel } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import type { DirectoryProfile, Clinic } from "@/types";

const COMPLETENESS_FIELDS: { key: keyof DirectoryProfile; label: string }[] = [
  { key: "servicesCompleted", label: "Services" },
  { key: "providersCompleted", label: "Providers" },
  { key: "locationCompleted", label: "Location" },
  { key: "hoursCompleted", label: "Hours" },
  { key: "pricingCompleted", label: "Pricing" },
  { key: "imagesCompleted", label: "Images" },
  { key: "bookingLinkCompleted", label: "Booking Link" },
];

export function DirectoryView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      directoryService.list(stage || undefined),
      clinicService.list(),
    ]).then(([d, c]) => {
      setProfiles(d.profiles);
      setClinics(c.clinics);
    }).finally(() => setLoading(false));
  }, [stage, refreshKey]);

  async function updateStatus(id: string, listingStatus: string) {
    try {
      await directoryService.update(id, { listingStatus });
      toast.success(`Listing status → ${directoryStageLabel(listingStatus)}`);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update listing status");
    }
  }

  return (
    <div>
      <PageHeader
        title="Directory Operations"
        description="Manage clinic listings for novalyte.io/directory"
        action={
          <Select value={stage} onValueChange={(v) => setStage(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All stages</SelectItem>
              {DIRECTORY_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <LoadingState label="Loading directory…" />
      ) : profiles.length === 0 ? (
        <EmptyState icon={Globe2} title="No directory profiles" description="Profiles are created when clinics enter the directory stage." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {profiles.map((p) => {
            const clinic = clinics.find((c) => c.id === p.clinicId);
            return (
              <Card key={p.id} className="p-4 gap-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <button
                    onClick={() => openClinic(p.clinicId)}
                    className="flex items-center gap-2 hover:text-primary text-left min-w-0"
                  >
                    <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.clinicName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[clinic?.city, clinic?.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                  </button>
                  <StatusBadge
                    label={directoryStageLabel(p.listingStatus)}
                    color={
                      p.listingStatus === "published" ? "green" :
                      p.listingStatus === "approved" ? "teal" :
                      p.listingStatus === "suspended" || p.listingStatus === "archived" ? "rose" :
                      p.listingStatus === "unclaimed" || p.listingStatus === "imported" ? "slate" : "amber"
                    }
                  />
                </div>

                {/* Completeness bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Completeness</span>
                    <ScoreBadge score={p.profileCompleteness} />
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${p.profileCompleteness}%` }}
                    />
                  </div>
                </div>

                {/* Field toggles */}
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {COMPLETENESS_FIELDS.map((f) => {
                    const done = Boolean(p[f.key]);
                    return (
                      <div
                        key={f.key as string}
                        className={`text-[10px] rounded px-1 py-1 border font-medium flex items-center justify-center gap-0.5 ${
                          done
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                        title={f.label}
                      >
                        {done ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3 opacity-40" />}
                        {f.label.slice(0, 4)}
                      </div>
                    );
                  })}
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 flex-wrap">
                  <StatusBadge label={p.claimStatus} color={p.claimStatus === "verified" ? "green" : p.claimStatus === "unclaimed" ? "slate" : "amber"} />
                  <StatusBadge label={p.verificationStatus} color={p.verificationStatus === "verified" ? "green" : p.verificationStatus === "rejected" ? "rose" : "amber"} />
                  <StatusBadge label={p.publicationStatus} color={p.publicationStatus === "published" ? "green" : p.publicationStatus === "ready" ? "teal" : "slate"} />
                  {p.lastReviewedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> {formatDate(p.lastReviewedAt)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => openClinic(p.clinicId)}>
                    <ExternalLink className="size-3.5" /> Open Clinic
                  </Button>
                  <div className="flex-1" />
                  <Select value={p.listingStatus} onValueChange={(v) => updateStatus(p.id, v)}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIRECTORY_STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
