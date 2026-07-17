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
 */
const SCRIPTS: CallScript[] = [
  {
    id: "directory-opening",
    name: "Opening — Directory Permission",
    description: "First-contact opener: explain Novalyte AI and ask permission to list the clinic.",
    category: "Intro",
    icon: PhoneCall,
    tone: "teal",
    whenToUse: "First outbound call — reach the person who manages the clinic listing",
    duration: "45s",
    sections: [
      {
        heading: "Opening",
        body: `Hi, this is Jamil Yakasai with Novalyte AI. I'm calling about your clinic's free verified directory listing — not a paid service or sales pitch.

Do you have a minute for me to explain what that means, and you can tell me if it's okay to continue?`,
      },
      {
        heading: "Purpose",
        body: `Novalyte AI maintains a verified directory so men searching for TRT and men's health care can find appropriate clinics. We'd like to include [CLINIC NAME] only with your permission.

The listing is free. I just need to confirm a few public details — phone, services, booking method — and whether we have permission to publish them.`,
      },
      {
        heading: "Permission ask",
        body: `Would it be okay for us to include your clinic in the Novalyte AI verified directory after we confirm those details with you?`,
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
        heading: "Thank + confirm scope",
        body: `Thank you — I'll summarize what will appear publicly: clinic name, location, core services, hours, and how patients book.

You can review everything before anything goes live, and you can ask us to update or remove the listing anytime.`,
      },
      {
        heading: "Information to collect now",
        body: `I'll confirm:
- Public clinic phone and address
- Core services (TRT, GLP-1, telehealth, etc.)
- Booking URL or phone booking method
- Whether you're accepting new patients
- Best email for the verification follow-up
- Name and role of the listing contact

Provider photos and credentials can come later via a short intake form.`,
      },
      {
        heading: "Close",
        body: `I'll send a verification summary to [EMAIL] today. Once you approve, we'll publish the listing. Is there anything you'd like changed before it goes live?`,
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
        body: `Yes — the verified directory listing is completely free. There is no charge to apply, verify your public details, or publish an approved profile.

This call is only about permission to list those public details. There is no paid contract or obligation on today's call.`,
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
        body: `Fair question. This specific call is not a sales call — I'm only asking permission to include your clinic in our free verified directory and to confirm a few public listing details.

There's no paid service or contract involved in what I'm asking today.`,
      },
    ],
  },
  {
    id: "objection-not-interested",
    name: "Objection — Not interested",
    description: "Respectful decline handling.",
    category: "Objections",
    icon: ShieldQuestion,
    tone: "rose",
    whenToUse: "Clinic declines or asks not to be called again",
    duration: "30s",
    sections: [
      {
        heading: "Script",
        body: `I understand — thank you for letting me know. There is no cost and no obligation for the directory listing.

Would you prefer I don't call again, or would a one-page email be helpful if you want to review it later? Either way, I appreciate your time.`,
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
        body: `Absolutely. Before I send it — what's the best email, and who manages the clinic's public listing or directory decisions?

I'll send a one-page overview of the free verified listing and the verification steps. Would a brief follow-up call after you review be helpful, or email only?`,
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
        body: `Thank you. Who usually handles the clinic's public listing or website directory decisions?

What's the best time to reach them, and may I send a brief verification email in the meantime? I won't publish anything without explicit permission.`,
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
        body: `Yes — you can review listing details before publication when you request it. Listings are permission-based only.

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
    duration: "20s",
    sections: [
      {
        heading: "Script",
        body: `Hi [FIRST NAME], this is Jamil Yakasai with Novalyte AI. I'm calling about your clinic's free verified directory listing — just permission to include your public clinic details.

I'll try again in a couple of days, or you can reach me at [PHONE]. Thanks.`,
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
        body: `Hi [FIRST NAME], Jamil Yakasai from Novalyte AI — this is my last message about your free directory listing.

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
        body: `Hi [FIRST NAME], Jamil with Novalyte AI. I sent the directory verification summary for [CLINIC NAME] — wanted to see if you had a chance to review it.

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
        <strong>Current campaign rule:</strong> These calls request permission for the free Novalyte AI directory listing and verify public clinic details. Do not mention paid acquisition, advertising, or lead packages on these calls.
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
