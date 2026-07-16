"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, LoadingState, EmptyState, SectionCard,
  ScoreBadge, StatusBadge, SavedViewSelector,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Users, CheckCircle2, XCircle, Route, Sparkles, Target,
  MapPin, Stethoscope, Calendar, DollarSign, Wand2,
} from "lucide-react";
import { patientService } from "@/services";
import type { PatientLead, ClinicMatch } from "@/types";
import { formatPhone, relativeTime } from "@/lib/format";
import { SERVICE_CATALOG } from "@/lib/constants";
import { toast } from "sonner";

export function ClinicMatchingView({ params }: { params?: Record<string, unknown> | null }) {
  const { refreshKey, navigate } = useNav();
  const [leads, setLeads] = useState<PatientLead[]>([]);
  const [matches, setMatches] = useState<ClinicMatch[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    setLoadingLeads(true);
    patientService
      .listLeads()
      .then((d) => {
        // Prefer leads that have matches (first 6 in mock) — surface those first.
        const ordered = [...d.leads].sort((a, b) => {
          const aHas = a.id.startsWith("pl_") ? parseInt(a.id.replace("pl_", "")) <= 6 ? 0 : 1 : 1;
          const bHas = b.id.startsWith("pl_") ? parseInt(b.id.replace("pl_", "")) <= 6 ? 0 : 1 : 1;
          return aHas - bHas;
        });
        setLeads(ordered);
        const preset = params?.leadId
          ? String(params.leadId)
          : ordered.find((l) => parseInt(l.id.replace("pl_", "")) <= 6)?.id ?? ordered[0]?.id ?? null;
        setSelectedLeadId(preset);
      })
      .finally(() => setLoadingLeads(false));
  }, [refreshKey, params?.leadId]);

  useEffect(() => {
    if (!selectedLeadId) {
      setMatches([]);
      return;
    }
    setLoadingMatches(true);
    patientService
      .getMatches(selectedLeadId)
      .then((d) => setMatches(d.matches))
      .finally(() => setLoadingMatches(false));
  }, [selectedLeadId, refreshKey]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  const topMatch = matches[0];
  const avgScore = matches.length
    ? Math.round(matches.reduce((s, m) => s + m.matchScore, 0) / matches.length)
    : 0;

  const treatmentName = (slug: string) =>
    SERVICE_CATALOG.find((s) => s.slug === slug)?.name ?? slug;

  function approve(match: ClinicMatch) {
    toast.success(`Match approved · ${match.clinicName}`, {
      description: `${selectedLead?.name ?? "Lead"} routed to ${match.clinicName} (score ${match.matchScore}).`,
    });
    setMatches((prev) => prev.filter((m) => m.id !== match.id));
  }

  function reject(match: ClinicMatch) {
    toast.info(`Match rejected · ${match.clinicName}`);
    setMatches((prev) => prev.filter((m) => m.id !== match.id));
  }

  function route(match: ClinicMatch) {
    toast.success(`Routing lead to ${match.clinicName}`, {
      description: "Patient details shared with clinic intake team.",
    });
    navigate("patient-leads");
  }

  const leadsWithOptions = leads.map((l) => ({
    id: l.id,
    name: l.name,
    hasMatches: parseInt(l.id.replace("pl_", "")) <= 6,
  }));

  return (
    <div>
      <PageHeader
        title="Clinic Matching"
        description="AI-scored clinic matches for patient leads — geographic, treatment, and capacity fit"
      />

      {loadingLeads ? (
        <SectionCard>
          <LoadingState label="Loading leads…" />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Select Patient Lead"
            description="Only the first 6 leads have pre-computed clinic matches in mock mode"
            bodyClassName="p-3"
          >
            <select
              value={selectedLeadId ?? ""}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {leadsWithOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.id} {l.hasMatches ? "✓" : "(no matches)"}
                </option>
              ))}
            </select>
          </SectionCard>

          {selectedLead && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-5 mt-4">
              <MetricCard label="Patient" value={selectedLead.name} icon={Users} tone="teal" hint={selectedLead.email ?? "—"} />
              <MetricCard label="Treatment" value={treatmentName(selectedLead.treatmentInterest)} icon={Stethoscope} tone="violet" />
              <MetricCard label="Match Pool" value={matches.length} icon={Target} tone="amber" hint={`Avg score ${avgScore}`} />
              <MetricCard label="Top Match" value={topMatch ? topMatch.matchScore : "—"} icon={Sparkles} tone="green" hint={topMatch?.clinicName ?? "No matches"} />
            </div>
          )}

          {selectedLead && (
            <Card className="mb-5 p-4 gap-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 text-sm">
                  <Field label="Location" value={selectedLead.city ? `${selectedLead.city}, ${selectedLead.state}` : selectedLead.state ?? "—"} icon={MapPin} />
                  <Field label="Phone" value={formatPhone(selectedLead.phone)} icon={Route} />
                  <Field label="Preferred Contact" value={selectedLead.preferredContact} icon={Wand2} />
                  <Field label="Submitted" value={relativeTime(selectedLead.createdAt)} icon={Calendar} />
                </div>
                <div className="flex gap-2 text-xs">
                  <ScoreBadge score={selectedLead.qualificationScore} />
                  <ScoreBadge score={selectedLead.urgencyScore} />
                </div>
              </div>
              {selectedLead.symptoms && (
                <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/60">
                  Symptoms: {selectedLead.symptoms}
                  {selectedLead.telehealthPreference && " · Telehealth preferred"}
                  {selectedLead.distancePreference && ` · Within ${selectedLead.distancePreference}mi`}
                </p>
              )}
            </Card>
          )}

          {loadingMatches ? (
            <SectionCard>
              <LoadingState label="Computing clinic matches…" />
            </SectionCard>
          ) : matches.length === 0 ? (
            <SectionCard>
              <EmptyState
                icon={XCircle}
                title="No clinic matches available"
                description="This lead does not have pre-computed matches in mock mode. Select one of the first 6 leads (pl_1 through pl_6) to see matches."
              />
            </SectionCard>
          ) : (
            <div className="space-y-3">
              <SavedViewSelector
                views={["All Matches", `Top ${Math.min(3, matches.length)}`, "Best Fit Only"]}
                active={"All Matches"}
                onSelect={() => {}}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matches.map((m) => (
                  <Card key={m.id} className="p-4 gap-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">{m.clinicName}</h3>
                          <StatusBadge
                            label={m.verificationStatus}
                            color={m.verificationStatus === "verified" ? "green" : m.verificationStatus === "pending" ? "amber" : "slate"}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.explanation}</p>
                      </div>
                      <ScoreBadge score={m.matchScore} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <FitBar label="Geographic" value={m.geographicFit} icon={MapPin} />
                      <FitBar label="Treatment" value={m.treatmentFit} icon={Stethoscope} />
                      <FitBar label="Capacity" value={m.capacityFit} icon={Calendar} />
                      <FitBar label="Telehealth" value={m.telehealthFit} icon={Wand2} />
                      <FitBar label="Booking" value={m.bookingFit} icon={CheckCircle2} />
                      <FitBar label="Price" value={m.priceFit} icon={DollarSign} />
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Button size="sm" onClick={() => approve(m)} className="flex-1">
                        <CheckCircle2 className="size-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => route(m)} className="flex-1">
                        <Route className="size-3.5" /> Route
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reject(m)} className="text-rose-600 hover:text-rose-700">
                        <XCircle className="size-3.5" /> Reject
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function FitBar({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  const tone = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-teal-500" : value >= 40 ? "bg-amber-500" : "bg-rose-400";
  return (
    <div className="rounded-md border border-border/70 px-2 py-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase text-muted-foreground tracking-wide truncate">
          <Icon className="size-2.5" />
          {label}
        </span>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
