"use client";

import { useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, EmptyState, FilterBar, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Phone, MessageSquare, Mail, Voicemail, ShieldQuestion, BookOpen, Copy, Check,
  ChevronDown, ChevronRight, PhoneCall, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScriptSection = {
  heading: string;
  body: string;
};

type CallScript = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  tone: "teal" | "amber" | "violet" | "green" | "rose";
  whenToUse: string;
  sections: ScriptSection[];
  duration: string;
};

const SCRIPTS: CallScript[] = [
  {
    id: "intro",
    name: "Cold Intro — Clinic Owner",
    description: "Opening 30 seconds for first contact with clinic owners / medical directors.",
    category: "Intro",
    icon: PhoneCall,
    tone: "teal",
    whenToUse: "First outbound call to a clinic decision-maker",
    duration: "30s",
    sections: [
      {
        heading: "Opening",
        body: `Hi, this is Jamil Yakasai with Novalyte. I'm reaching out because we've been working with men's health clinics in [STATE] to bring them exclusive, qualified patient leads — without the typical ad-spend games.

I know you're busy — do you have 60 seconds for me to tell you why I called, and you can decide if it's worth continuing?`,
      },
      {
        heading: "Permission to continue",
        body: `Great. The reason I called: we run patient-acquisition campaigns nationally for TRT, GLP-1, and hormone optimization. We route qualified, intent-verified patients directly to partner clinics — they only pay when a patient actually books.

If I could show you 8-12 new qualified patients in your area next month, would that be worth a 20-minute conversation this week?`,
      },
      {
        heading: "If yes → book meeting",
        body: `Perfect. I have Thursday at 2pm or Friday at 10am your time. Which works better?

(If they hesitate) I'll send a calendar invite — what's the best email?`,
      },
    ],
  },
  {
    id: "permission-to-list",
    name: "Permission-to-List Pitch",
    description: "Get permission to add clinic to Novalyte directory (free listing).",
    category: "Directory",
    icon: BookOpen,
    tone: "violet",
    whenToUse: "Once you've established rapport and want to add the clinic to the directory",
    duration: "2 min",
    sections: [
      {
        heading: "Pitch",
        body: `One thing I'd love to do — even if you're not ready for paid leads — is add Summit Vitality to our national directory at no cost. It's a free listing that puts you in front of ~40K men/month searching for TRT and hormone care in Texas.

You'd keep 100% of the booking revenue, and it takes me about 10 minutes to set up with you on the phone. Are you open to that?`,
      },
      {
        heading: "If yes → collect info",
        body: `Great. I'll need:
- Your services list (TRT, GLP-1, etc.)
- Provider names + credentials
- Hours + booking link
- 2-3 clinic photos (you can email later)

I'll send a quick intake form — should take 5 minutes to fill out.`,
      },
      {
        heading: "If no / hesitation",
        body: `Totally understand. Two options:
1. I send you a one-pager about the directory, you decide later
2. We skip the directory and just talk about paid leads next time

Which feels better?`,
      },
    ],
  },
  {
    id: "objection-budget",
    name: "Objection Handling — No Budget",
    description: "When clinic says they don't have budget for marketing.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "After pitch, if prospect cites budget constraints",
    duration: "60s",
    sections: [
      {
        heading: "Acknowledge + reframe",
        body: `I appreciate you being upfront about budget — that's actually the right conversation to have.

Here's the thing: we don't charge upfront ad spend. You pay a performance fee only when a patient books an appointment. So if we don't deliver patients, you don't pay.

In other words — there's no budget risk. We're investing our ad dollars up front.`,
      },
      {
        heading: "Anchor to current spend",
        body: `Out of curiosity — what are you spending now on Google Ads or Facebook? Most clinics we work with are spending $4-8K/month with mixed results.

We typically come in below that because we only bill on booked appointments, not clicks. Would it be worth comparing what you're paying now vs. our cost-per-booking?`,
      },
      {
        heading: "If still no",
        body: `Makes sense. Let's start with the free directory listing — zero cost, you keep 100% of bookings. Once you see the patient flow, we can revisit paid leads in 30 days.

Fair?`,
      },
    ],
  },
  {
    id: "objection-existing-agency",
    name: "Objection Handling — Already Has Agency",
    description: "When clinic says they already work with a marketing agency.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "When prospect has existing marketing partner",
    duration: "90s",
    sections: [
      {
        heading: "Validate + differentiate",
        body: `Got it — and I wouldn't expect you to fire them. Most of our partner clinics keep their existing agency for branding, social, and SEO.

We're different because we only do performance-based patient acquisition. We don't touch your brand or website. We just send you booked appointments.

Think of us like an additional patient channel that runs alongside what you already have.`,
      },
      {
        heading: "Pilot offer",
        body: `Here's what I'd propose: a 30-day pilot at reduced cost. We send you patients, you measure ROI. If we're not the best-performing channel by day 30, we shake hands and walk away.

Worth trying alongside your current setup?`,
      },
    ],
  },
  {
    id: "voicemail",
    name: "Voicemail — 1st Attempt",
    description: "Short voicemail for first unanswered call.",
    category: "Voicemail",
    icon: Voicemail,
    tone: "teal",
    whenToUse: "First voicemail after no-answer on cold outreach",
    duration: "20s",
    sections: [
      {
        heading: "Script",
        body: `Hi [FIRST NAME], this is Jamil Yakasai with Novalyte. I'm reaching out because we help men's health clinics in [STATE] get exclusive, qualified patient leads on a performance basis.

I'll try you again in a couple of days. If you'd like to chat sooner, my direct line is [PHONE]. Thanks — talk soon.`,
      },
    ],
  },
  {
    id: "voicemail-followup",
    name: "Voicemail — 3rd Attempt (Final)",
    description: "Breakup voicemail after multiple unanswered attempts.",
    category: "Voicemail",
    icon: Voicemail,
    tone: "rose",
    whenToUse: "Final touch after 2-3 unanswered calls — breakup style",
    duration: "25s",
    sections: [
      {
        heading: "Script",
        body: `Hi [FIRST NAME], Jamil Yakasai from Novalyte — this is my third message. I'll take that as a sign the timing isn't right.

I'll close out your file for now. If anything changes and you want to revisit getting qualified TRT and GLP-1 patients in [STATE], my direct line is [PHONE].

Wishing you and the clinic the best. Take care.`,
      },
    ],
  },
  {
    id: "post-meeting-followup",
    name: "Post-Meeting Follow-Up",
    description: "Call to send recap + proposal after a discovery meeting.",
    category: "Follow-Up",
    icon: Mail,
    tone: "green",
    whenToUse: "Within 24 hours of a discovery call",
    duration: "60s",
    sections: [
      {
        heading: "Opening",
        body: `Hey [FIRST NAME], Jamil with Novalyte. Great conversation yesterday — really enjoyed learning about your clinic's growth plans.

I'm sending over the recap email and proposal today. Two quick things:

1. I'll include the patient-demand data we discussed for [CITY]
2. I'll attach a draft pilot agreement — no signature required yet

When would be a good time to review it together? I have [DAY] morning or [DAY] afternoon open.`,
      },
    ],
  },
];

const CATEGORY_OPTIONS = [
  { value: "Intro", label: "Intro" },
  { value: "Directory", label: "Directory" },
  { value: "Objections", label: "Objections" },
  { value: "Voicemail", label: "Voicemail" },
  { value: "Follow-Up", label: "Follow-Up" },
];

export function CallScriptsView() {
  const { navigate } = useNav();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(SCRIPTS[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = SCRIPTS.filter((s) => {
    const q = search.trim().toLowerCase();
    if (q && !`${s.name} ${s.description} ${s.category}`.toLowerCase().includes(q)) return false;
    if (activeFilters.category && s.category !== activeFilters.category) return false;
    return true;
  });

  function copyScript(script: CallScript) {
    const text = script.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    toast.success(`Copied "${script.name}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const columns: Column<CallScript>[] = [
    {
      key: "name",
      header: "Script",
      render: (s) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <s.icon className="size-4 text-muted-foreground" />
            <p className="font-medium truncate">{s.name}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (s) => <StatusBadge label={s.category} color="slate" />,
      sortValue: (s) => s.category,
      hideOnMobile: true,
    },
    {
      key: "duration",
      header: "Duration",
      render: (s) => <span className="text-sm text-muted-foreground tabular-nums">{s.duration}</span>,
      sortValue: (s) => s.duration,
      hideOnMobile: true,
    },
    {
      key: "sections",
      header: "Sections",
      render: (s) => <span className="text-sm text-muted-foreground tabular-nums">{s.sections.length}</span>,
      sortValue: (s) => s.sections.length,
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Call Scripts"
        description="Reusable scripts for cold outreach, objection handling, and follow-ups"
        action={
          <Button variant="outline" onClick={() => navigate("call-queue")}>
            <Phone className="size-4" /> Open call queue
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[{ key: "category", label: "Category", options: CATEGORY_OPTIONS }]}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search scripts by name, description…"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Script list */}
        <div className="lg:col-span-1">
          <SectionCard title="Script Library" description={`${filtered.length} scripts`} bodyClassName="p-0">
            {filtered.length === 0 ? (
              <EmptyState icon={BookOpen} title="No scripts match" />
            ) : (
              <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto nv-scroll">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setExpandedId(s.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors",
                      expandedId === s.id && "bg-accent/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <s.icon className="size-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium truncate flex-1">{s.name}</p>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{s.duration}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Script detail */}
        <div className="lg:col-span-2">
          {filtered.length === 0 ? (
            <SectionCard>
              <EmptyState icon={Sparkles} title="Nothing to show" description="Adjust your search to find scripts." />
            </SectionCard>
          ) : (
            <ScriptDetail
              script={filtered.find((s) => s.id === expandedId) ?? filtered[0]}
              copied={copiedId === (filtered.find((s) => s.id === expandedId) ?? filtered[0]).id}
              onCopy={() => copyScript(filtered.find((s) => s.id === expandedId) ?? filtered[0])}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptDetail({ script, copied, onCopy }: { script: CallScript; copied: boolean; onCopy: () => void }) {
  const [openSection, setOpenSection] = useState(0);

  return (
    <SectionCard
      title={script.name}
      description={script.description}
      action={
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      }
      bodyClassName="p-4"
    >
      <div className="flex items-center gap-3 mb-4 text-xs">
        <StatusBadge label={script.category} color="slate" />
        <span className="text-muted-foreground">{script.duration}</span>
        <span className="text-muted-foreground">· {script.sections.length} sections</span>
      </div>

      <div className="rounded-md bg-teal-50 border border-teal-200 px-3 py-2 mb-4">
        <p className="text-xs text-teal-700 font-medium uppercase tracking-wide mb-0.5">When to use</p>
        <p className="text-sm text-teal-800">{script.whenToUse}</p>
      </div>

      <div className="space-y-3">
        {script.sections.map((s, i) => (
          <div key={i} className="border border-border/70 rounded-md overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === i ? -1 : i)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              <span className="text-sm font-medium">
                <span className="text-muted-foreground tabular-nums mr-2">{i + 1}.</span>
                {s.heading}
              </span>
              {openSection === i ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            </button>
            {openSection === i && (
              <div className="px-3 py-3">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{s.body}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
