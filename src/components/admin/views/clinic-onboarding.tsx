"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Rocket,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  Users,
  MapPin,
  Calendar,
  Link as LinkIcon,
  Stethoscope,
} from "lucide-react";
import { directoryService, clinicService } from "@/services";
import { stageLabel } from "@/lib/constants";
import { toast } from "sonner";
import type { Clinic, DirectoryProfile } from "@/types";

interface OnboardingStep {
  key: string;
  label: string;
  icon: typeof FileText;
  done: boolean;
}

export function ClinicOnboardingView() {
  const { openClinic, refresh, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      clinicService.list({ stage: "directory_approved" }),
      clinicService.list({ stage: "pilot_proposed" }),
      clinicService.list({ stage: "pilot_active" }),
      directoryService.list(),
    ]).then(([approved, proposed, active, dir]) => {
      const combined = [...approved.clinics, ...proposed.clinics, ...active.clinics];
      setClinics(combined);
      setProfiles(dir.profiles);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  const rows = useMemo(() => {
    return clinics.map((c) => {
      const profile = profiles.find((p) => p.clinicId === c.id);
      const steps: OnboardingStep[] = [
        { key: "profile", label: "Profile Complete", icon: Building2, done: (c.profileCompletion ?? 0) >= 60 },
        { key: "services", label: "Services Verified", icon: Stethoscope, done: profile?.servicesCompleted ?? c.services.length > 0 },
        { key: "providers", label: "Providers Added", icon: Users, done: profile?.providersCompleted ?? (c.numberOfProviders ?? 0) > 0 },
        { key: "booking", label: "Booking Link", icon: LinkIcon, done: profile?.bookingLinkCompleted ?? false },
        { key: "contract", label: "Contract Signed", icon: FileText, done: c.paid },
      ];
      const completedCount = steps.filter((s) => s.done).length;
      return { clinic: c, steps, completedCount, total: steps.length };
    });
  }, [clinics, profiles]);

  return (
    <div>
      <PageHeader
        title="Clinic Onboarding"
        description="Onboarding workflow for directory-approved clinics → pilot"
        action={
          <Button variant="outline" onClick={() => toast.info("Export onboarding checklist (CSV) — coming soon.")}>
            <FileText className="size-4" /> Export
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="Loading onboarding clinics…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No clinics in onboarding"
          description="Clinics move here when they reach the 'directory_approved' stage."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map(({ clinic, steps, completedCount, total }) => {
            const pct = Math.round((completedCount / total) * 100);
            return (
              <Card key={clinic.id} className="p-4 gap-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <button
                    onClick={() => openClinic(clinic.id)}
                    className="flex items-center gap-2 hover:text-primary text-left min-w-0"
                  >
                    <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{clinic.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="size-3" />
                        {[clinic.city, clinic.state].filter(Boolean).join(", ")} · {stageLabel(clinic.pipelineStage)}
                      </p>
                    </div>
                  </button>
                  <ScoreBadge score={pct} />
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Onboarding progress</span>
                    <span className="font-medium tabular-nums">{completedCount}/{total} steps</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-1.5 mb-3">
                  {steps.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.key} className="flex items-center gap-2 text-sm">
                        {s.done ? (
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <Icon className="size-3.5 text-muted-foreground shrink-0" />
                        <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                        {!s.done && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-6 text-xs px-2"
                            onClick={() => toast.info(`Mark '${s.label}' complete — handled in clinic detail page.`)}
                          >
                            Mark done
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => openClinic(clinic.id)}>
                    <Building2 className="size-3.5" /> Open Clinic
                  </Button>
                  <div className="flex-1" />
                  {pct === 100 ? (
                    <StatusBadge label="Ready for pilot" color="green" />
                  ) : (
                    <StatusBadge label={`${total - completedCount} remaining`} color="amber" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
