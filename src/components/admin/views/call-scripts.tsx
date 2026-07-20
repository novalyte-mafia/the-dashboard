"use client";

import { useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, EmptyState, FilterBar,
  StatusBadge,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Phone, Mail, Voicemail, ShieldQuestion, BookOpen, Copy, Check,
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
  icon: typeof PhoneCall;
  tone: "teal" | "amber" | "violet" | "green" | "rose";
  whenToUse: string;
  sections: ScriptSection[];
  duration: string;
};

/**
 * Directory-permission call scripts only.
 * Do not mention paid acquisition, advertising, lead packages, or commercial offers.
 * Aligned with Founder-Led Call Mode (founder-led-script.ts) for tomorrow's outreach.
 */
const SCRIPTS: CallScript[] = [
  {
    id: "directory-opening",
    name: "Opening — When clinic answers",
    description: "Greeting → free directory purpose → ask for the right person.",
    category: "Intro",
    icon: PhoneCall,
    tone: "teal",
    whenToUse: "Clinic picks up — first 20 seconds",
    duration: "45s",
    sections: [
      {
        heading: "Greeting",
        body: `Hi, good morning. My name is Jamil, and I'm calling from Novalyte AI. How are you doing today?`,
      },
      {
        heading: "Purpose + right person",
        body: `I'm reaching out because we're building a patient-facing directory for men's health clinics, and we'd like to include your clinic at no cost. I just need to speak with whoever handles your clinic information, partnerships, or marketing. Who would be the best person for that?`,
      },
    ],
  },
  {
    id: "gatekeeper-regarding",
    name: "Gatekeeper — What is this regarding?",
    description: "Short answer, then stop talking.",
    category: "Intro",
    icon: PhoneCall,
    tone: "teal",
    whenToUse: "Receptionist asks what the call is about",
    duration: "20s",
    sections: [
      {
        heading: "Script",
        body: `It's regarding a free clinic listing. We're creating a directory that helps patients discover men's health providers, and I'm calling to confirm whether we have permission to include the clinic and verify the information.

Then stop talking.`,
      },
    ],
  },
  {
    id: "decision-maker-permission",
    name: "Decision-maker — Permission ask",
    description: "Founder intro + free listing ask. Pause for their answer.",
    category: "Intro",
    icon: PhoneCall,
    tone: "teal",
    whenToUse: "Transferred to owner / manager / marketing",
    duration: "60s",
    sections: [
      {
        heading: "Intro",
        body: `Hi, my name is Jamil. I'm the founder of Novalyte AI. We're building a healthcare discovery platform, beginning with men's health, to help patients find reputable clinics based on their location and the services they need.`,
      },
      {
        heading: "Permission ask",
        body: `I'm reaching out because we'd like to create a free directory profile for your clinic. There is no charge and no commitment. I just wanted to ask whether you would be comfortable with us including the clinic.

Then stop and let them answer.`,
      },
    ],
  },
  {
    id: "permission-granted",
    name: "Permission Granted — Verification",
    description: "Collect listing details after the clinic agrees.",
    category: "Directory",
    icon: BookOpen,
    tone: "violet",
    whenToUse: "Clinic says yes to directory listing permission",
    duration: "3 min",
    sections: [
      {
        heading: "Thank + scope",
        body: `Excellent. Thank you. I'll keep this simple. I just need to verify a few details so we represent the clinic accurately.`,
      },
      {
        heading: "Information to collect now",
        body: `Ask:
- What is the correct clinic name?
- What locations do you currently serve?
- Do you offer telehealth, in-person care, or both?
- What are the main services you would want patients to know about?
- Would you like us to send patients to your website, phone number, or a specific booking link?
- Who should review the profile before it is published?
- What is the best email address for that person?`,
      },
      {
        heading: "Close",
        body: `Perfect. I'll prepare the profile and send it for review before anything is finalized. Once you approve it, we can publish it in the directory.

Is there a specific day I should follow up if I haven't heard back?`,
      },
    ],
  },
  {
    id: "objection-is-it-free",
    name: "Objection — Is the listing free?",
    description: "Answer cost and “catch” questions directly.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "Clinic asks about fees, cost, or what the catch is",
    duration: "30s",
    sections: [
      {
        heading: "Script",
        body: `There is no cost for the directory profile. We will not put you on a paid agreement or charge the clinic for being included.

This call is only about permission and verifying public details.`,
      },
    ],
  },
  {
    id: "objection-is-this-sales",
    name: "Objection — Are you selling something?",
    description: "Clarify this is directory permission only.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "Clinic asks if this is a sales or marketing call",
    duration: "30s",
    sections: [
      {
        heading: "Script",
        body: `No. There is no payment required for the directory listing. I'm only calling to request permission and confirm the clinic's information.`,
      },
    ],
  },
  {
    id: "objection-traffic",
    name: "Objection — Do you have patient traffic?",
    description: "Honest launch answer — do not exaggerate.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "Clinic asks about volume, leads, or current traffic",
    duration: "45s",
    sections: [
      {
        heading: "Script",
        body: `I'll be straight with you: we're launching the directory and onboarding the first clinic partners now. The platform is live at novalyte.io, and we're building the clinic network and patient education content together.

I don't want to exaggerate current traffic — early partners help shape the directory while we grow distribution.`,
      },
    ],
  },
  {
    id: "objection-not-interested",
    name: "Objection — Not interested / don't list us",
    description: "Respectful decline handling.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "rose",
    whenToUse: "Clinic declines listing or asks not to be called again",
    duration: "30s",
    sections: [
      {
        heading: "Script",
        body: `Understood. Thank you for letting me know. I'll mark the clinic as not approved for publication.

May I ask whether there is a specific concern, so we can make sure we handle clinics appropriately?

Do not argue. Offer email-only or do-not-contact if they prefer.`,
      },
    ],
  },
  {
    id: "objection-send-email",
    name: "Objection — Send me an email",
    description: "Capture contact and send directory overview.",
    category: "Objections",
    icon: Mail,
    tone: "green",
    whenToUse: "Clinic prefers email over phone",
    duration: "45s",
    sections: [
      {
        heading: "Script",
        body: `Of course. What's the best email address, and whose attention should I put it to?

I'll send a short overview explaining the free listing, what information would appear, and how the clinic can review or correct it before publication.`,
      },
    ],
  },
  {
    id: "objection-owner-unavailable",
    name: "Objection — Owner / manager not available",
    description: "Gatekeeper workflow.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "Front desk cannot grant listing permission",
    duration: "45s",
    sections: [
      {
        heading: "Script",
        body: `No problem. May I have their name, email address, and the best time to call back?

Is there anything specific I should include so they understand why I'm reaching out? I won't publish anything without explicit permission.`,
      },
    ],
  },
  {
    id: "objection-enough-patients",
    name: "Objection — We have enough patients",
    description: "Capacity-friendly listing pitch.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "amber",
    whenToUse: "Clinic says they don't need more patients",
    duration: "30s",
    sections: [
      {
        heading: "Script",
        body: `That makes sense. The listing does not require the clinic to accept additional patients or participate in any paid program. We can also make capacity or appointment availability clear on the profile.

Would you still be comfortable with a basic informational listing?`,
      },
    ],
  },
  {
    id: "objection-review-remove",
    name: "Review, update, or remove listing",
    description: "Answer control and privacy questions.",
    category: "Directory",
    icon: BookOpen,
    tone: "violet",
    whenToUse: "Clinic asks about reviewing, updating, or removing their listing",
    duration: "30s",
    sections: [
      {
        heading: "Script",
        body: `Nothing goes live without clinic review when you request it. Listings are permission-based only.

If anything changes, you can ask us to update or remove your profile. We don't publish without your explicit permission.`,
      },
    ],
  },
  {
    id: "voicemail",
    name: "Voicemail — Directory outreach",
    description: "Short voicemail for first unanswered call.",
    category: "Voicemail",
    icon: Voicemail,
    tone: "teal",
    whenToUse: "First voicemail after no-answer",
    duration: "25s",
    sections: [
      {
        heading: "Script",
        body: `Hi, this is Jamil, founder of Novalyte AI. We're building a patient-facing directory for men's health clinics, and I'm calling to request permission to include your clinic at no cost. I'd also like to verify the clinic's information before anything is published. You can reach me at [PHONE], or I'll send a brief email as well. Again, this is Jamil from Novalyte AI. Thank you.`,
      },
    ],
  },
  {
    id: "voicemail-followup",
    name: "Voicemail — Final attempt",
    description: "Polite close after multiple unanswered attempts.",
    category: "Voicemail",
    icon: Voicemail,
    tone: "rose",
    whenToUse: "Final touch after 2–3 unanswered calls",
    duration: "20s",
    sections: [
      {
        heading: "Script",
        body: `Hi, Jamil Yakasai from Novalyte AI — this is my last message about your free directory listing.

I'll close your file for now. If you'd like to be included later, my line is [PHONE]. Wishing you and the clinic the best.`,
      },
    ],
  },
  {
    id: "followup-verification",
    name: "Follow-Up — Verification email sent",
    description: "After sending listing verification summary.",
    category: "Follow-Up",
    icon: Mail,
    tone: "green",
    whenToUse: "Within 2–3 days of sending verification materials",
    duration: "45s",
    sections: [
      {
        heading: "Script",
        body: `Hi [FIRST NAME], Jamil with Novalyte AI. I sent the directory profile draft for [CLINIC NAME] — wanted to see if you had a chance to review it.

Happy to adjust any public details before publication. Do you have permission for us to proceed with the listing, or would you like changes first?`,
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

  return (
    <div>
      <PageHeader
        title="Call Scripts"
        description="Directory-permission outreach scripts — free listing verification only (no paid offers)"
        action={
          <Button variant="outline" onClick={() => navigate("calls")}>
            <Phone className="size-4" /> Open calling cockpit
          </Button>
        }
      />

      <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50/80 px-4 py-3 text-sm text-teal-900">
        <strong>Tomorrow’s campaign rule:</strong> Permission first — free Novalyte directory listing only.
        Be honest if asked about traffic (launching / first partners; platform live). Do not pitch paid
        acquisition, advertising, or the full ecosystem. Nothing publishes without clinic review.
        Use <strong>Founder-Led Call Mode</strong> in Dialpad for the live talking-point HUD.
      </div>

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
