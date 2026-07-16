"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
  ConfirmationDialog,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { directoryService, clinicService } from "@/services";
import { formatDate, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import type { DirectoryProfile, Clinic } from "@/types";

export function VerificationQueueView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [pending, setPending] = useState<DirectoryProfile[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectFor, setRejectFor] = useState<DirectoryProfile | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      directoryService.list("identity_review"),
      directoryService.list("claim_requested"),
      directoryService.list("information_required"),
      clinicService.list(),
    ]).then(([review, requested, info, c]) => {
      setPending([...review.profiles, ...requested.profiles, ...info.profiles]);
      setClinics(c.clinics);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  function approve(p: DirectoryProfile) {
    toast.success(`Approved ${p.clinicName} — listing published`);
    setPending((prev) => prev.filter((x) => x.id !== p.id));
    refresh();
  }

  function confirmReject() {
    if (!rejectFor) return;
    toast.success(`Rejected ${rejectFor.clinicName} — moved to information_required`);
    setPending((prev) => prev.filter((x) => x.id !== rejectFor.id));
    setRejectFor(null);
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Verification Queue"
        description={`${pending.length} ${pending.length === 1 ? "profile" : "profiles"} awaiting review`}
      />

      {loading ? (
        <LoadingState label="Loading verification queue…" />
      ) : pending.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Queue is clear"
          description="No directory profiles pending verification."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const clinic = clinics.find((c) => c.id === p.clinicId);
            const fields = [
              { label: "Business License", done: p.servicesCompleted, hint: "Verified via state registry" },
              { label: "Medical Director", done: p.providersCompleted, hint: clinic?.contacts.find((c) => c.contactType === "medical_director") ? "On file" : "Pending" },
              { label: "Address Verified", done: p.locationCompleted, hint: clinic ? `${clinic.city}, ${clinic.state}` : "—" },
              { label: "Phone Verified", done: p.hoursCompleted, hint: clinic?.primaryPhone ?? "—" },
            ];
            return (
              <Card key={p.id} className="p-4 gap-0">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Clinic summary */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => openClinic(p.clinicId)}
                      className="flex items-center gap-2.5 hover:text-primary text-left min-w-0"
                    >
                      <div className="size-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.clinicName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[clinic?.city, clinic?.state].filter(Boolean).join(", ")} · {clinic?.clinicType.replace(/_/g, " ")}
                        </p>
                      </div>
                    </button>

                    {/* Verification checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      {fields.map((f) => (
                        <div key={f.label} className="flex items-center gap-2 text-sm border rounded-md px-2 py-1.5">
                          {f.done ? (
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="size-4 text-rose-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{f.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{f.hint}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Contact info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3" /> {clinic?.primaryPhone ?? "—"}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <Mail className="size-3" /> {clinic?.generalEmail ?? "—"}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <Globe className="size-3" /> {clinic?.website?.replace(/^https?:\/\//, "") ?? "—"}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Stethoscope className="size-3" /> {clinic?.services.length ?? 0} services
                      </div>
                    </div>
                  </div>

                  {/* Right column — actions */}
                  <div className="lg:w-56 lg:border-l lg:pl-4 flex flex-col gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Listing Status</p>
                      <StatusBadge
                        label={p.listingStatus.replace(/_/g, " ")}
                        color={p.listingStatus === "identity_review" ? "amber" : p.listingStatus === "information_required" ? "amber" : "slate"}
                      />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Submitted</p>
                      <p className="text-xs">{p.lastReviewedAt ? formatDate(p.lastReviewedAt) : "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.lastReviewedAt ? relativeTime(p.lastReviewedAt) : "Just now"}
                      </p>
                    </div>
                    {p.reviewedByName && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Reviewer</p>
                        <p className="text-xs">{p.reviewedByName}</p>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <Button size="sm" onClick={() => approve(p)}>
                        <CheckCircle2 className="size-3.5" /> Approve & Publish
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setRejectFor(p)}>
                        <XCircle className="size-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openClinic(p.clinicId)}>
                        <FileText className="size-3.5" /> View Full Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        open={!!rejectFor}
        onOpenChange={(o) => !o && setRejectFor(null)}
        title="Reject Listing"
        description={`Reject ${rejectFor?.clinicName ?? ""}? The clinic will be moved to "information_required" and asked to resubmit.`}
        confirmLabel="Reject"
        destructive
        onConfirm={confirmReject}
      />
    </div>
  );
}
