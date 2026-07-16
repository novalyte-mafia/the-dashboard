"use client";

import { useState } from "react";
import {
  PageHeader, MetricCard, SectionCard, StatusBadge, ScoreBadge, DataTable,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Target, TrendingUp, Brain, RefreshCw, Save, Plus, Minus, Zap,
} from "lucide-react";
import { toast } from "sonner";

interface ScoringFactor {
  id: string;
  label: string;
  description: string;
  weight: number; // 0-100
  category: "demographic" | "behavioral" | "intent" | "contextual";
}

const INITIAL_FACTORS: ScoringFactor[] = [
  { id: "f1", label: "Treatment Match", description: "How well patient's treatment interest matches clinic specialty", weight: 25, category: "intent" },
  { id: "f2", label: "Geographic Proximity", description: "Distance between patient and clinic (closer = higher)", weight: 15, category: "contextual" },
  { id: "f3", label: "Insurance Fit", description: "Patient insurance preference matches clinic accepted plans", weight: 10, category: "demographic" },
  { id: "f4", label: "Telehealth Preference", description: "Telehealth match — both patient and clinic offer virtual", weight: 8, category: "behavioral" },
  { id: "f5", label: "Urgency Score", description: "How soon patient needs care (assessment-based)", weight: 18, category: "intent" },
  { id: "f6", label: "Engagement Level", description: "Form completion depth and time spent on assessment", weight: 12, category: "behavioral" },
  { id: "f7", label: "Budget Alignment", description: "Self-pay willingness matches clinic pricing", weight: 7, category: "demographic" },
  { id: "f8", label: "Clinic Capacity", description: "Current clinic utilization (lower = higher match)", weight: 5, category: "contextual" },
];

const CATEGORY_COLOR: Record<string, string> = {
  demographic: "teal", behavioral: "violet", intent: "amber", contextual: "green",
};

interface SampleLead {
  id: string;
  name: string;
  treatmentInterest: string;
  location: string;
  urgency: number;
  insurance: string;
  score: number;
  confidence: "high" | "medium" | "low";
  factors: { label: string; contribution: number }[];
}

const SAMPLE_LEADS: SampleLead[] = [
  {
    id: "pl_1",
    name: "Marcus Johnson",
    treatmentInterest: "TRT",
    location: "Austin, TX",
    urgency: 85,
    insurance: "self_pay",
    score: 92,
    confidence: "high",
    factors: [
      { label: "Treatment Match", contribution: 24 },
      { label: "Geographic Proximity", contribution: 14 },
      { label: "Urgency Score", contribution: 17 },
    ],
  },
  {
    id: "pl_2",
    name: "Daniel Kim",
    treatmentInterest: "GLP-1",
    location: "Houston, TX",
    urgency: 70,
    insurance: "insurance",
    score: 78,
    confidence: "high",
    factors: [
      { label: "Treatment Match", contribution: 22 },
      { label: "Insurance Fit", contribution: 9 },
      { label: "Urgency Score", contribution: 13 },
    ],
  },
  {
    id: "pl_3",
    name: "Robert Hayes",
    treatmentInterest: "Peptide Therapy",
    location: "Denver, CO",
    urgency: 45,
    insurance: "self_pay",
    score: 64,
    confidence: "medium",
    factors: [
      { label: "Treatment Match", contribution: 19 },
      { label: "Budget Alignment", contribution: 7 },
      { label: "Geographic Proximity", contribution: 11 },
    ],
  },
  {
    id: "pl_4",
    name: "James Foster",
    treatmentInterest: "IV Therapy",
    location: "Phoenix, AZ",
    urgency: 30,
    insurance: "unsure",
    score: 48,
    confidence: "low",
    factors: [
      { label: "Treatment Match", contribution: 15 },
      { label: "Engagement Level", contribution: 8 },
    ],
  },
  {
    id: "pl_5",
    name: "Anthony Rivera",
    treatmentInterest: "ED Care",
    location: "Atlanta, GA",
    urgency: 90,
    insurance: "self_pay",
    score: 95,
    confidence: "high",
    factors: [
      { label: "Treatment Match", contribution: 25 },
      { label: "Urgency Score", contribution: 18 },
      { label: "Budget Alignment", contribution: 7 },
    ],
  },
  {
    id: "pl_6",
    name: "Kevin Brooks",
    treatmentInterest: "Hormone Optimization",
    location: "Miami, FL",
    urgency: 60,
    insurance: "insurance",
    score: 71,
    confidence: "medium",
    factors: [
      { label: "Treatment Match", contribution: 22 },
      { label: "Geographic Proximity", contribution: 13 },
      { label: "Urgency Score", contribution: 11 },
    ],
  },
];

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "green", medium: "amber", low: "rose",
};

export function LeadScoringView() {
  const [factors, setFactors] = useState<ScoringFactor[]>(INITIAL_FACTORS);
  const [retraining, setRetraining] = useState(false);

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const isBalanced = totalWeight === 100;

  const updateWeight = (id: string, weight: number) => {
    setFactors((prev) => prev.map((f) => f.id === id ? { ...f, weight } : f));
  };

  const handleRetrain = () => {
    setRetraining(true);
    toast.info("Retraining lead scoring model on historical data…");
    setTimeout(() => {
      setRetraining(false);
      toast.success("Model retrained — accuracy improved by 4.2%.");
    }, 2000);
  };

  const highConfidence = SAMPLE_LEADS.filter((l) => l.confidence === "high").length;
  const avgScore = Math.round(SAMPLE_LEADS.reduce((s, l) => s + l.score, 0) / SAMPLE_LEADS.length);

  return (
    <div>
      <PageHeader
        title="Lead Scoring"
        description="Configure the model that ranks patient leads for clinic matching"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => toast.success("Configuration saved.")}>
              <Save className="size-4" /> Save
            </Button>
            <Button onClick={handleRetrain} disabled={retraining}>
              <RefreshCw className={`size-4 ${retraining ? "animate-spin" : ""}`} /> {retraining ? "Training…" : "Retrain Model"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Scoring Factors" value={factors.length} icon={Target} tone="teal" />
        <MetricCard label="Total Weight" value={`${totalWeight}%`} icon={Zap} tone={isBalanced ? "green" : "amber"} hint={isBalanced ? "Balanced (100%)" : "Should equal 100%"} />
        <MetricCard label="High-Confidence Leads" value={highConfidence} icon={Brain} tone="violet" hint="Last 30 days" />
        <MetricCard label="Avg Lead Score" value={avgScore} icon={TrendingUp} tone="green" hint="Sample leads" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <SectionCard
          title="Scoring Factors & Weights"
          description="Drag sliders to adjust model"
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            {factors.map((f) => (
              <div key={f.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{f.label}</span>
                      <StatusBadge label={f.category} color={CATEGORY_COLOR[f.category]} className="!text-[9px] !px-1.5 !py-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => updateWeight(f.id, Math.max(0, f.weight - 1))}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <div className="w-14 text-right">
                      <span className="text-sm font-semibold tabular-nums">{f.weight}%</span>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => updateWeight(f.id, Math.min(100, f.weight + 1))}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[f.weight]}
                  onValueChange={(v) => updateWeight(f.id, v[0])}
                  min={0}
                  max={40}
                  step={1}
                  className="py-1"
                />
              </div>
            ))}
          </div>
          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-sm ${isBalanced ? "text-emerald-700" : "text-amber-700"}`}>
            <span className="font-medium">{isBalanced ? "✓ Weights balanced (100%)" : `⚠ Weights total ${totalWeight}% (should be 100%)`}</span>
            <Button variant="ghost" size="sm" onClick={() => {
              // Normalize to 100
              const factor = 100 / totalWeight;
              setFactors((prev) => prev.map((f) => ({ ...f, weight: Math.round(f.weight * factor) })));
              toast.success("Weights normalized to 100%.");
            }}>
              Auto-balance
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Model Performance"
          description="Last training run"
        >
          <div className="space-y-3">
            <PerfMetric label="Accuracy" value="87.4%" trend={+4.2} />
            <PerfMetric label="Precision" value="84.1%" trend={+2.8} />
            <PerfMetric label="Recall" value="91.2%" trend={+5.1} />
            <PerfMetric label="F1 Score" value="0.875" trend={+0.038} />
            <div className="pt-3 border-t">
              <div className="text-xs text-muted-foreground">Training set</div>
              <div className="text-sm font-medium mt-0.5">2,840 historical leads</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last trained</div>
              <div className="text-sm font-medium mt-0.5">3 days ago</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Model version</div>
              <div className="text-sm font-medium mt-0.5">v2.4.1</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Sample Scored Leads"
        description="Recent leads with model output and factor contributions"
        bodyClassName="p-0"
      >
        <DataTable
          data={SAMPLE_LEADS}
          emptyTitle="No scored leads"
          columns={[
            {
              key: "name",
              header: "Lead",
              sortValue: (l) => l.name,
              render: (l) => (
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.treatmentInterest}</div>
                </div>
              ),
            },
            {
              key: "location",
              header: "Location",
              hideOnMobile: true,
              sortValue: (l) => l.location,
              render: (l) => <span className="text-sm">{l.location}</span>,
            },
            {
              key: "urgency",
              header: "Urgency",
              hideOnMobile: true,
              sortValue: (l) => l.urgency,
              render: (l) => <span className="text-sm tabular-nums">{l.urgency}</span>,
            },
            {
              key: "insurance",
              header: "Insurance",
              hideOnMobile: true,
              render: (l) => <StatusBadge label={l.insurance.replace(/_/g, " ")} color="slate" />,
            },
            {
              key: "score",
              header: "Score",
              sortValue: (l) => l.score,
              render: (l) => <ScoreBadge score={l.score} />,
            },
            {
              key: "confidence",
              header: "Confidence",
              sortValue: (l) => l.confidence,
              render: (l) => <StatusBadge label={l.confidence} color={CONFIDENCE_COLOR[l.confidence]} />,
            },
            {
              key: "factors",
              header: "Top Factors",
              hideOnMobile: true,
              render: (l) => (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {l.factors.slice(0, 2).map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span>{f.label}</span>
                      <span className="tabular-nums">+{f.contribution}</span>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function PerfMetric({ label, value, trend }: { label: string; value: string; trend: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        <span className={`text-xs tabular-nums ${trend >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}
        </span>
      </div>
    </div>
  );
}
