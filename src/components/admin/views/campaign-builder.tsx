"use client";

import { useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, FormSection, ConfirmationDialog,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Rocket, Settings, Target, DollarSign, Image as ImageIcon,
  CheckCircle2, ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import { SERVICE_CATALOG, US_STATES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "google", label: "Google Ads" },
  { id: "meta", label: "Meta (Facebook/Instagram)" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
];

const OBJECTIVES = [
  { id: "lead_gen", label: "Lead Generation" },
  { id: "brand_awareness", label: "Brand Awareness" },
  { id: "traffic", label: "Traffic" },
  { id: "conversions", label: "Conversions" },
  { id: "engagement", label: "Engagement" },
];

const STEPS = [
  { id: "details", label: "Campaign Details", icon: Settings },
  { id: "targeting", label: "Targeting", icon: Target },
  { id: "budget", label: "Budget & Bidding", icon: DollarSign },
  { id: "creative", label: "Ad Creative", icon: ImageIcon },
  { id: "review", label: "Review & Launch", icon: Rocket },
];

interface CampaignDraft {
  name: string;
  platform: string;
  objective: string;
  description: string;
  geoStates: string[];
  audience: string;
  keywords: string;
  budget: string;
  bidStrategy: string;
  headline: string;
  primaryText: string;
  cta: string;
  landingUrl: string;
}

const DEFAULT_DRAFT: CampaignDraft = {
  name: "",
  platform: "google",
  objective: "lead_gen",
  description: "",
  geoStates: [],
  audience: "",
  keywords: "",
  budget: "5000",
  bidStrategy: "max_cpl",
  headline: "",
  primaryText: "",
  cta: "Book Now",
  landingUrl: "https://novalyte.io/",
};

export function CampaignBuilderView() {
  const { navigate } = useNav();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignDraft>(DEFAULT_DRAFT);
  const [launchOpen, setLaunchOpen] = useState(false);

  function update<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleState(state: string) {
    setDraft((prev) => ({
      ...prev,
      geoStates: prev.geoStates.includes(state)
        ? prev.geoStates.filter((s) => s !== state)
        : [...prev.geoStates, state],
    }));
  }

  function launch() {
    toast.success(`Campaign launched · ${draft.name || "Untitled Campaign"}`, {
      description: `${PLATFORMS.find((p) => p.id === draft.platform)?.label} · Budget ${formatCurrency(Number(draft.budget) || 0)} · Status: In Review`,
    });
    setLaunchOpen(false);
    navigate("campaign-dashboard");
  }

  const canAdvance = step === 0 ? draft.name.trim().length > 0 : true;
  const isLast = step === STEPS.length - 1;

  return (
    <div>
      <PageHeader
        title="Campaign Builder"
        description="Multi-step wizard to launch a new advertising campaign"
      />

      {/* Step indicator */}
      <div className="mb-5 overflow-x-auto nv-scroll">
        <div className="flex items-center min-w-[640px]">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCurrent = i === step;
            const isComplete = i < step;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => i <= step && setStep(i)}
                  className={
                    "flex items-center gap-2 text-left " +
                    (i > step ? "cursor-default opacity-50" : "cursor-pointer")
                  }
                >
                  <span
                    className={
                      "size-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors " +
                      (isCurrent
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                        : isComplete
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {isComplete ? <CheckCircle2 className="size-4" /> : i + 1}
                  </span>
                  <div className="hidden sm:block">
                    <p className={"text-[10px] uppercase tracking-wide text-muted-foreground"}>Step {i + 1}</p>
                    <p className={"text-xs font-medium " + (isCurrent ? "text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={"flex-1 h-0.5 mx-2 " + (i < step ? "bg-primary/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
        <TabsList className="hidden">
          {STEPS.map((s, i) => (
            <TabsTrigger key={s.id} value={String(i)}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="0" className="mt-0">
          <SectionCard title="Campaign Details" description="Name, platform, objective & description">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input
                    id="name"
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. TRT Search — Q4 National"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="platform">Platform</Label>
                  <select
                    id="platform"
                    value={draft.platform}
                    onChange={(e) => update("platform", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="objective">Campaign Objective</Label>
                  <select
                    id="objective"
                    value={draft.objective}
                    onChange={(e) => update("objective", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {OBJECTIVES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cta">Default Call-To-Action</Label>
                  <Input
                    id="cta"
                    value={draft.cta}
                    onChange={(e) => update("cta", e.target.value)}
                    placeholder="e.g. Book Now, Get Started"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Internal description of campaign goals & target audience…"
                  rows={3}
                />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="1" className="mt-0">
          <SectionCard title="Targeting" description="Geography, audience & keyword targeting">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Geography — States</Label>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto nv-scroll rounded-md border border-input p-2">
                  {US_STATES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleState(s)}
                      className={
                        "text-xs font-medium px-2 py-1 rounded-md border transition-colors " +
                        (draft.geoStates.includes(s)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-accent border-border")
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {draft.geoStates.length === 0 ? "No states selected — campaign will run nationally" : `${draft.geoStates.length} state(s) selected: ${draft.geoStates.join(", ")}`}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="audience">Audience Targeting</Label>
                  <Input
                    id="audience"
                    value={draft.audience}
                    onChange={(e) => update("audience", e.target.value)}
                    placeholder="e.g. Men 35-55, interested in TRT"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="treatment">Treatment Focus</Label>
                  <select
                    id="treatment"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {SERVICE_CATALOG.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="keywords">Keywords (one per line)</Label>
                <Textarea
                  id="keywords"
                  value={draft.keywords}
                  onChange={(e) => update("keywords", e.target.value)}
                  placeholder={"trt clinic near me\ntestosterone replacement therapy\nlow testosterone treatment"}
                  rows={4}
                />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="2" className="mt-0">
          <SectionCard title="Budget & Bidding" description="Set total budget and bidding strategy">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="budget">Total Budget (USD)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={draft.budget}
                  onChange={(e) => update("budget", e.target.value)}
                  placeholder="5000"
                />
                <p className="text-xs text-muted-foreground">
                  Estimated reach: ~{Math.round(Number(draft.budget || 0) / 60)} leads at $60 avg CPL
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bid">Bid Strategy</Label>
                <select
                  id="bid"
                  value={draft.bidStrategy}
                  onChange={(e) => update("bidStrategy", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="max_cpl">Maximize CPL (target $60)</option>
                  <option value="max_clicks">Maximize Clicks</option>
                  <option value="max_conversions">Maximize Conversions</option>
                  <option value="target_cpa">Target CPA ($80)</option>
                  <option value="manual_cpc">Manual CPC</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Daily Budget</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrency(Math.round(Number(draft.budget || 0) / 30))}</p>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Est. Impressions</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{(Number(draft.budget || 0) * 35).toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Est. Clicks</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{(Number(draft.budget || 0) * 0.7).toLocaleString()}</p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="3" className="mt-0">
          <SectionCard title="Ad Creative" description="Headline, primary text & landing destination">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={draft.headline}
                  onChange={(e) => update("headline", e.target.value)}
                  placeholder="e.g. TRT Therapy — Book Your Consultation"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">{draft.headline.length}/60 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="primaryText">Primary Text</Label>
                <Textarea
                  id="primaryText"
                  value={draft.primaryText}
                  onChange={(e) => update("primaryText", e.target.value)}
                  placeholder="Feeling tired, low energy, or noticing decreased performance? TRT may help. Book a confidential consultation with a men's-health specialist near you."
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">{draft.primaryText.length}/500 characters</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="landing">Landing Page URL</Label>
                <Input
                  id="landing"
                  value={draft.landingUrl}
                  onChange={(e) => update("landingUrl", e.target.value)}
                  placeholder="https://novalyte.io/trt-consult"
                />
              </div>

              <div className="rounded-md border border-dashed border-border p-6 text-center">
                <ImageIcon className="size-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Upload Creative Assets</p>
                <p className="text-xs text-muted-foreground mt-1">Drag & drop images or videos (mock — uploads disabled)</p>
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="size-3.5" /> Browse Files
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="4" className="mt-0">
          <SectionCard title="Review & Launch" description="Confirm details before submitting for review">
            <div className="space-y-4">
              <FormSection title="Campaign">
                <ReviewItem label="Name" value={draft.name || "—"} />
                <ReviewItem label="Platform" value={PLATFORMS.find((p) => p.id === draft.platform)?.label ?? draft.platform} />
                <ReviewItem label="Objective" value={OBJECTIVES.find((o) => o.id === draft.objective)?.label ?? draft.objective} />
                <ReviewItem label="CTA" value={draft.cta} />
              </FormSection>

              <FormSection title="Targeting">
                <ReviewItem label="Geography" value={draft.geoStates.length ? draft.geoStates.join(", ") : "National (all states)"} />
                <ReviewItem label="Audience" value={draft.audience || "—"} />
                <ReviewItem
                  label="Keywords"
                  value={draft.keywords ? `${draft.keywords.split("\n").filter(Boolean).length} keywords` : "—"}
                />
              </FormSection>

              <FormSection title="Budget & Creative">
                <ReviewItem label="Total Budget" value={formatCurrency(Number(draft.budget) || 0)} />
                <ReviewItem label="Bid Strategy" value={draft.bidStrategy.replace(/_/g, " ")} />
                <ReviewItem label="Headline" value={draft.headline || "—"} />
                <ReviewItem label="Landing URL" value={draft.landingUrl} />
              </FormSection>

              <div className="rounded-md bg-teal-50 border border-teal-200 p-3 text-xs text-teal-800">
                <CheckCircle2 className="size-4 inline mr-1.5 -mt-0.5" />
                Ready to launch. Campaign will enter <strong>review</strong> status and begin serving once approved (typically 1-4 hours).
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => navigate("campaign-dashboard")}>Cancel</Button>
                <Button onClick={() => setLaunchOpen(true)}>
                  <Rocket className="size-4" /> Launch Campaign
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Bottom nav */}
      <div className="flex items-center justify-between mt-5">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ChevronLeft className="size-4" /> Back
        </Button>
        {!isLast ? (
          <Button disabled={!canAdvance} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Next <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={() => setLaunchOpen(true)}>
            <Rocket className="size-4" /> Launch
          </Button>
        )}
      </div>

      <ConfirmationDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        title="Launch Campaign?"
        description={`${draft.name || "Untitled Campaign"} will be submitted for review on ${PLATFORMS.find((p) => p.id === draft.platform)?.label}. You will be notified once approved.`}
        confirmLabel="Launch Now"
        onConfirm={launch}
      />
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}
