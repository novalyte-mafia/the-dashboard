"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { LoadingState, StageBadge, PriorityBadge, ReadinessScore, DealStageBadge, DirectoryStageBadge, EmptyState } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, PhoneCall, Plus, MapPin, Globe, Mail, Phone, Clock, UserPlus, Calendar, TrendingUp, ExternalLink, Save } from "lucide-react";
import { formatPhone, formatCurrency, formatCurrencyFull, relativeTime, formatDate, formatDateTime, localTime, isWithinCallingHours, fullName } from "@/lib/format";
import { PIPELINE_STAGES, STAGE_MAP, CONTACT_TYPES, SERVICE_CATALOG, PRIORITIES, FOLLOWUP_TYPES, CALL_OUTCOMES, OUTCOME_MAP } from "@/lib/constants";
import { toast } from "sonner";
import { AddContactDialog } from "@/components/admin/add-contact-dialog";

interface ClinicDetail {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  generalEmail: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  timezone: string;
  numberOfLocations: number;
  clinicType: string;
  telehealth: boolean;
  operatingStatus: string;
  pipelineStage: string;
  priority: string;
  readinessScore: number;
  readinessOverride: number | null;
  readinessOverrideReason: string | null;
  lastContactedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  callAttempts: number;
  interested: boolean;
  paid: boolean;
  doNotCall: boolean;
  directoryStatus: string;
  dealValue: number;
  owner: string | null;
  ownerMember: { firstName: string; lastName: string; email: string } | null;
  qualification: string;
  notes: string | null;
  contacts: { id: string; firstName: string; lastName: string; title: string | null; contactType: string; email: string | null; directPhone: string | null; mobilePhone: string | null; linkedinUrl: string | null; preferredContactMethod: string; isDecisionMaker: boolean; isPrimary: boolean; lastContactedAt: string | null; consentStatus: string; notes: string | null }[];
  services: { id: string; name: string; slug: string }[];
  callSessions: { id: string; startedAt: string; durationSec: number; outcome: string; answered: boolean; decisionMakerReached: boolean; interestLevel: string; notes: string | null; nextAction: string | null; attemptNumber: number; contact: { firstName: string; lastName: string } | null; admin: { firstName: string; lastName: string } | null }[];
  followUps: { id: string; title: string; taskType: string; priority: string; dueDate: string | null; status: string; notes: string | null; completedAt: string | null; admin: { firstName: string; lastName: string } | null }[];
  deals: { id: string; name: string; stage: string; offer: string | null; estimatedTotalValue: number; estimatedMonthlyValue: number; probability: number; expectedCloseDate: string | null; paymentStatus: string; contractStatus: string }[];
  directoryProfile: { id: string; listingStatus: string; claimStatus: string; verificationStatus: string; profileCompleteness: number; servicesCompleted: boolean; providersCompleted: boolean; locationCompleted: boolean; hoursCompleted: boolean; pricingCompleted: boolean; imagesCompleted: boolean; bookingLinkCompleted: boolean; publicationStatus: string; lastReviewedAt: string | null; reviewedBy: { firstName: string; lastName: string } | null } | null;
  pipelineHistory: { id: string; fromStage: string | null; toStage: string; changedAt: string; reason: string | null; note: string | null; changedBy: { firstName: string; lastName: string } | null }[];
  activities: { id: string; action: string; summary: string; timestamp: string; admin: { firstName: string; lastName: string } | null }[];
}

export function ClinicDetailView({ clinicId }: { clinicId: string }) {
  const { navigate, openLogCall, refresh, refreshKey } = useNav();
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/clinics/${clinicId}`)
      .then((r) => r.json())
      .then((d) => {
        setClinic(d.clinic);
        setNotesDraft(d.clinic?.notes ?? "");
      })
      .catch(() => toast.error("Failed to load clinic"))
      .finally(() => setLoading(false));
  }, [clinicId, refreshKey]);

  if (loading || !clinic) return <LoadingState label="Loading clinic…" />;

  const withinHours = isWithinCallingHours(clinic.timezone);
  const qualification = JSON.parse(clinic.qualification || "{}") as Record<string, unknown>;

  async function changeStage(toStage: string) {
    const res = await fetch(`/api/clinics/${clinicId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStage }),
    });
    if (res.ok) {
      toast.success(`Stage → ${STAGE_MAP[toStage]?.label}`);
      refresh();
    } else toast.error("Failed to update stage");
  }

  async function saveNotes() {
    const res = await fetch(`/api/clinics/${clinicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    if (res.ok) toast.success("Notes saved");
    else toast.error("Failed to save notes");
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("clinics", null)} className="mb-2 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to clinics
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{clinic.name}</h1>
              <StageBadge stage={clinic.pipelineStage} />
              <PriorityBadge priority={clinic.priority} />
              {clinic.interested && <Badge className="bg-amber-50 text-amber-700 border-amber-200">Interested</Badge>}
              {clinic.paid && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Paid</Badge>}
              {clinic.doNotCall && <Badge variant="destructive">Do Not Call</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><MapPin className="size-3.5" />{[clinic.city, clinic.state].filter(Boolean).join(", ") || "—"}</span>
              {clinic.website && <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary"><Globe className="size-3.5" />{clinic.website.replace(/^https?:\/\//, "")}<ExternalLink className="size-3" /></a>}
              <span className="flex items-center gap-1"><Clock className="size-3.5" />Local: {localTime(clinic.timezone)}{!withinHours && <span className="text-rose-500 ml-1">· outside calling hours</span>}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={clinic.pipelineStage} onValueChange={changeStage}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{PIPELINE_STAGES.filter((s) => s.active).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={() => openLogCall(clinicId)} disabled={clinic.doNotCall}>
              <PhoneCall className="size-4" /> Log Call
            </Button>
          </div>
        </div>
      </div>

      {/* Key stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Readiness</p><div className="mt-1"><ReadinessScore score={clinic.readinessScore} /></div></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Call Attempts</p><p className="text-lg font-semibold tabular-nums mt-0.5">{clinic.callAttempts}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Last Contact</p><p className="text-sm font-medium mt-0.5">{relativeTime(clinic.lastContactedAt)}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Next Action</p><p className="text-sm font-medium mt-0.5 truncate">{clinic.nextAction || "—"}</p></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 overflow-x-auto nv-scroll">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({clinic.contacts.length})</TabsTrigger>
          <TabsTrigger value="calls">Calls ({clinic.callSessions.length})</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-Ups ({clinic.followUps.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({clinic.deals.length})</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3">Clinic Identity</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label="Legal Name" value={clinic.legalName} />
                <Detail label="Clinic Type" value={clinic.clinicType.replace(/_/g, " ")} />
                <Detail label="Primary Phone" value={formatPhone(clinic.primaryPhone)} />
                <Detail label="Secondary Phone" value={formatPhone(clinic.secondaryPhone)} />
                <Detail label="General Email" value={clinic.generalEmail} />
                <Detail label="Locations" value={String(clinic.numberOfLocations)} />
                <Detail label="Address" value={clinic.address} />
                <Detail label="ZIP" value={clinic.zip} />
                <Detail label="Telehealth" value={clinic.telehealth ? "Yes" : "No"} />
                <Detail label="Operating" value={clinic.operatingStatus} />
                <Detail label="Owner" value={clinic.ownerMember ? fullName(clinic.ownerMember.firstName, clinic.ownerMember.lastName) : "—"} />
                <Detail label="Directory" value={clinic.directoryStatus} />
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Services</h3>
              {clinic.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {clinic.services.map((s) => <Badge key={s.id} variant="secondary" className="bg-primary/5 text-primary border-primary/20">{s.name}</Badge>)}
                </div>
              )}
              <h3 className="text-sm font-semibold mt-4 mb-2">Qualification</h3>
              <div className="space-y-1.5 text-xs">
                {Object.entries(qualification).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").toLowerCase()}:</span>
                    <span className="font-medium text-right">{String(v)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Notes</h3>
              <Button variant="ghost" size="sm" onClick={saveNotes}><Save className="size-3.5" /> Save</Button>
            </div>
            <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} placeholder="Internal notes…" />
          </Card>
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts">
          <Card className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Decision-Makers & Contacts</h3>
              <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}><UserPlus className="size-4" /> Add Contact</Button>
            </div>
            {clinic.contacts.length === 0 ? (
              <EmptyState icon={UserPlus} title="No contacts yet" description="Add decision-makers and contacts to qualify this clinic." action={<Button size="sm" onClick={() => setAddContactOpen(true)}><Plus className="size-4" /> Add Contact</Button>} />
            ) : (
              <div className="divide-y">
                {clinic.contacts.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {(c.firstName[0] ?? "?")}{(c.lastName[0] ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                        {c.isDecisionMaker && <Badge className="bg-teal-50 text-teal-700 border-teal-200">Decision-Maker</Badge>}
                        {c.isPrimary && <Badge variant="outline">Primary</Badge>}
                        <Badge variant="secondary" className="capitalize">{c.contactType.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {c.title && <span>{c.title}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="size-3" />{c.email}</span>}
                        {c.directPhone && <span className="flex items-center gap-1"><Phone className="size-3" />{formatPhone(c.directPhone)}</span>}
                        {c.mobilePhone && <span className="flex items-center gap-1"><Phone className="size-3" />{formatPhone(c.mobilePhone)}</span>}
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                    </div>
                    <div className="text-xs text-muted-foreground text-right shrink-0">
                      <p>Last: {relativeTime(c.lastContactedAt)}</p>
                      <p className="capitalize">{c.preferredContactMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Calls */}
        <TabsContent value="calls">
          <Card className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Call History</h3>
              <Button size="sm" onClick={() => openLogCall(clinicId)} disabled={clinic.doNotCall}><PhoneCall className="size-4" /> Log Call</Button>
            </div>
            {clinic.callSessions.length === 0 ? (
              <EmptyState icon={PhoneCall} title="No calls logged yet" />
            ) : (
              <div className="divide-y">
                {clinic.callSessions.map((c) => {
                  const oc = OUTCOME_MAP[c.outcome];
                  return (
                    <div key={c.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">Attempt #{c.attemptNumber}</span>
                          <Badge className={`bg-${oc?.color ?? "slate"}-50 text-${oc?.color ?? "slate"}-700 border-${oc?.color ?? "slate"}-200`}>{oc?.label ?? c.outcome}</Badge>
                          {c.decisionMakerReached && <Badge variant="outline">DM reached</Badge>}
                          <Badge variant="secondary" className="capitalize">{c.interestLevel}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(c.startedAt)} · {Math.round(c.durationSec / 60)}m</span>
                      </div>
                      {c.notes && <p className="text-sm text-muted-foreground mt-1">{c.notes}</p>}
                      {c.nextAction && <p className="text-xs text-primary mt-1">Next: {c.nextAction}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">By {c.admin ? fullName(c.admin.firstName, c.admin.lastName) : "—"}{c.contact ? ` · with ${fullName(c.contact.firstName, c.contact.lastName)}` : ""}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Follow-ups */}
        <TabsContent value="follow-ups">
          <Card className="p-0">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-semibold">Follow-Ups for this Clinic</h3></div>
            {clinic.followUps.length === 0 ? (
              <EmptyState icon={Calendar} title="No follow-ups" />
            ) : (
              <div className="divide-y">
                {clinic.followUps.map((f) => (
                  <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="capitalize">{f.taskType.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span>Due {f.dueDate ? formatDate(f.dueDate) : "—"}</span>
                        <span>·</span>
                        <span className="capitalize">{f.status.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <PriorityBadge priority={f.priority} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Deals */}
        <TabsContent value="deals">
          <Card className="p-0">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-semibold">Deals & Opportunities</h3></div>
            {clinic.deals.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No deals yet" description="Create a deal when this clinic expresses commercial interest." />
            ) : (
              <div className="divide-y">
                {clinic.deals.map((d) => (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{d.name}</p>
                      <DealStageBadge stage={d.stage} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                      <div><span className="text-muted-foreground">Offer: </span>{d.offer || "—"}</div>
                      <div><span className="text-muted-foreground">Monthly: </span>{formatCurrency(d.estimatedMonthlyValue)}</div>
                      <div><span className="text-muted-foreground">Total: </span>{formatCurrency(d.estimatedTotalValue)}</div>
                      <div><span className="text-muted-foreground">Probability: </span>{d.probability}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Directory */}
        <TabsContent value="directory">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Directory Profile</h3>
              {clinic.directoryProfile && <DirectoryStageBadge stage={clinic.directoryProfile.listingStatus} />}
            </div>
            {clinic.directoryProfile ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Profile Completeness</span>
                    <span className="font-medium tabular-nums">{clinic.directoryProfile.profileCompleteness}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${clinic.directoryProfile.profileCompleteness}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    ["Services", clinic.directoryProfile.servicesCompleted],
                    ["Providers", clinic.directoryProfile.providersCompleted],
                    ["Location", clinic.directoryProfile.locationCompleted],
                    ["Hours", clinic.directoryProfile.hoursCompleted],
                    ["Pricing", clinic.directoryProfile.pricingCompleted],
                    ["Images", clinic.directoryProfile.imagesCompleted],
                    ["Booking Link", clinic.directoryProfile.bookingLinkCompleted],
                  ].map(([label, done]) => (
                    <div key={label as string} className={`text-xs rounded-md border px-2 py-1.5 ${done ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                      {label as string}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Detail label="Claim Status" value={clinic.directoryProfile.claimStatus} />
                  <Detail label="Verification" value={clinic.directoryProfile.verificationStatus} />
                  <Detail label="Publication" value={clinic.directoryProfile.publicationStatus} />
                  <Detail label="Last Reviewed" value={clinic.directoryProfile.lastReviewedAt ? formatDate(clinic.directoryProfile.lastReviewedAt) : "—"} />
                </div>
              </div>
            ) : (
              <EmptyState icon={Globe} title="No directory profile" description="This clinic has no directory listing yet." />
            )}
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          <Card className="p-0">
            <div className="px-4 py-3 border-b"><h3 className="text-sm font-semibold">Activity History</h3></div>
            {clinic.activities.length === 0 ? (
              <EmptyState icon={Clock} title="No activity recorded" />
            ) : (
              <div className="divide-y">
                {clinic.activities.map((a) => (
                  <div key={a.id} className="px-4 py-2.5">
                    <p className="text-sm">{a.summary}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.admin ? fullName(a.admin.firstName, a.admin.lastName) + " · " : ""}{relativeTime(a.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pipeline history sidebar */}
      {clinic.pipelineHistory.length > 0 && tab === "overview" && (
        <Card className="p-4 mt-4">
          <h3 className="text-sm font-semibold mb-3">Pipeline History</h3>
          <div className="space-y-2">
            {clinic.pipelineHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground tabular-nums w-28">{formatDateTime(h.changedAt)}</span>
                <StageBadge stage={h.fromStage ?? "—"} className="opacity-60" />
                <span className="text-muted-foreground">→</span>
                <StageBadge stage={h.toStage} />
                {h.reason && <span className="text-muted-foreground truncate">· {h.reason}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <AddContactDialog clinicId={clinicId} open={addContactOpen} onOpenChange={setAddContactOpen} onAdded={() => refresh()} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value || "—"}</p>
    </div>
  );
}
