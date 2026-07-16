"use client";

import { useState } from "react";
import {
  PageHeader, MetricCard, SectionCard, StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Phone, FileText, Target, Building2, Sparkles, Activity, Cpu, Zap, Settings,
} from "lucide-react";
import { toast } from "sonner";

interface AiAssistant {
  id: string;
  name: string;
  description: string;
  model: string;
  capabilities: string[];
  status: "active" | "beta" | "disabled";
  usageCount: number;
  usageTrend: number;
  icon: React.ElementType;
  tone: "teal" | "violet" | "amber" | "green";
  lastUsedAt: string;
  costPerUse: number;
}

const ASSISTANTS: AiAssistant[] = [
  {
    id: "ai_1",
    name: "Call Copilot",
    description: "Real-time coaching during calls — objection handling, talk-track suggestions, sentiment monitoring, and live call summaries.",
    model: "gpt-4o-realtime",
    capabilities: ["Realtime transcription", "Objection handling", "Sentiment analysis", "Live talk-track suggestions", "Auto call summary", "Next-step recommendations"],
    status: "active",
    usageCount: 1240,
    usageTrend: 18,
    icon: Phone,
    tone: "teal",
    lastUsedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    costPerUse: 0.045,
  },
  {
    id: "ai_2",
    name: "Content Generator",
    description: "Drafts SEO-optimized articles, meta descriptions, social copy, and email sequences from a brief or keyword.",
    model: "gpt-4o",
    capabilities: ["Article drafting", "SEO optimization", "Meta tag generation", "Social copy variants", "Email sequence drafting", "Tone matching"],
    status: "active",
    usageCount: 480,
    usageTrend: 32,
    icon: FileText,
    tone: "violet",
    lastUsedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    costPerUse: 0.12,
  },
  {
    id: "ai_3",
    name: "Lead Scorer",
    description: "Scores patient leads on qualification, urgency, and conversion likelihood using behavioral signals and demographic fit.",
    model: "gpt-4o-mini + classifier",
    capabilities: ["Lead qualification scoring", "Urgency detection", "Conversion likelihood", "Demographic fit", "Behavioral signals", "Queue assignment"],
    status: "active",
    usageCount: 2840,
    usageTrend: 8,
    icon: Target,
    tone: "amber",
    lastUsedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    costPerUse: 0.008,
  },
  {
    id: "ai_4",
    name: "Clinic Researcher",
    description: "Pre-call intelligence — pulls clinic info, recent news, provider roster, tech stack, and suggested conversation hooks.",
    model: "gpt-4o + web search",
    capabilities: ["Clinic profile enrichment", "Provider roster lookup", "Tech stack detection", "Recent news scan", "Conversation hooks", "Competitor intelligence"],
    status: "active",
    usageCount: 320,
    usageTrend: 24,
    icon: Building2,
    tone: "green",
    lastUsedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    costPerUse: 0.18,
  },
  {
    id: "ai_5",
    name: "Outreach Composer",
    description: "Personalizes outreach emails and LinkedIn messages using clinic research and prospect role signals.",
    model: "gpt-4o-mini",
    capabilities: ["Email personalization", "LinkedIn message drafting", "Subject line variants", "Follow-up sequencing", "Tone calibration"],
    status: "beta",
    usageCount: 145,
    usageTrend: 56,
    icon: Sparkles,
    tone: "teal",
    lastUsedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    costPerUse: 0.022,
  },
  {
    id: "ai_6",
    name: "Proposal Generator",
    description: "Drafts partnership proposals and pilot agreements from deal context, clinic profile, and historical win patterns.",
    model: "gpt-4o",
    capabilities: ["Proposal drafting", "Pilot scope suggestion", "Pricing recommendations", "Contract template matching", "Risk flagging"],
    status: "beta",
    usageCount: 42,
    usageTrend: 12,
    icon: FileText,
    tone: "violet",
    lastUsedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    costPerUse: 0.28,
  },
];

const STATUS_COLOR: Record<string, string> = {
  active: "green", beta: "amber", disabled: "slate",
};

const TONE_BG: Record<string, string> = {
  teal: "bg-teal-50 text-teal-700",
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
};

export function AiAssistantsView() {
  const [selected, setSelected] = useState<AiAssistant | null>(null);

  const totalUsage = ASSISTANTS.reduce((s, a) => s + a.usageCount, 0);
  const activeCount = ASSISTANTS.filter((a) => a.status === "active").length;
  const betaCount = ASSISTANTS.filter((a) => a.status === "beta").length;
  const totalCost = ASSISTANTS.reduce((s, a) => s + a.usageCount * a.costPerUse, 0);

  return (
    <div>
      <PageHeader
        title="AI Assistants"
        description={`${ASSISTANTS.length} AI models powering Novalyte workflows`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Active" value={activeCount} icon={Cpu} tone="green" />
        <MetricCard label="In Beta" value={betaCount} icon={Activity} tone="amber" />
        <MetricCard label="Total Uses" value={totalUsage.toLocaleString()} icon={Zap} tone="teal" hint="All-time" />
        <MetricCard label="Est. Spend" value={`$${totalCost.toFixed(0)}`} icon={Sparkles} tone="violet" hint="Cumulative" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ASSISTANTS.map((a) => {
          const Icon = a.icon;
          return (
            <SectionCard
              key={a.id}
              bodyClassName="p-4"
              className="hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer"
            >
              <div onClick={() => setSelected(a)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`size-10 rounded-lg flex items-center justify-center ${TONE_BG[a.tone]}`}>
                    <Icon className="size-5" />
                  </div>
                  <StatusBadge label={a.status} color={STATUS_COLOR[a.status]} />
                </div>
                <h3 className="text-base font-semibold">{a.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{a.description}</p>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Cpu className="size-3" />
                    <code className="font-mono">{a.model}</code>
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-semibold tabular-nums">{a.usageCount.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Uses</div>
                  </div>
                  <div>
                    <div className={`text-sm font-semibold tabular-nums ${a.usageTrend >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {a.usageTrend >= 0 ? "+" : ""}{a.usageTrend}%
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">Trend</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold tabular-nums">${a.costPerUse.toFixed(3)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Per use</div>
                  </div>
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-background border-l shadow-xl overflow-y-auto nv-scroll">
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
              <h3 className="text-sm font-semibold">{selected.name}</h3>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelected(null)}>×</Button>
            </div>
            <div className="p-4 space-y-5">
              <div className="flex items-start gap-3">
                <div className={`size-12 rounded-lg flex items-center justify-center ${TONE_BG[selected.tone]}`}>
                  <selected.icon className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Model: <code className="font-mono">{selected.model}</code>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Capabilities</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.capabilities.map((c) => (
                    <StatusBadge key={c} label={c} color="teal" />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1"><StatusBadge label={selected.status} color={STATUS_COLOR[selected.status]} /></div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Uses</div>
                  <div className="font-medium tabular-nums">{selected.usageCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cost per Use</div>
                  <div className="font-medium tabular-nums">${selected.costPerUse.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Trend (30d)</div>
                  <div className={`font-medium tabular-nums ${selected.usageTrend >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {selected.usageTrend >= 0 ? "+" : ""}{selected.usageTrend}%
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => toast.info(`Settings for ${selected.name}.`)}>
                  <Settings className="size-3.5" /> Configure
                </Button>
                <Button size="sm" className="ml-auto" onClick={() => toast.success(`${selected.name} triggered manually.`)}>
                  <Sparkles className="size-3.5" /> Test Run
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
