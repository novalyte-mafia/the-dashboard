"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  RefreshCw,
  Target,
} from "lucide-react";
import type { ClinicIntelligenceProfile } from "@/lib/clinic-intelligence/types";
import { toast } from "sonner";

function fitBadge(fit?: string | null) {
  switch (fit) {
    case "strong_fit":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "possible_fit":
      return "bg-sky-100 text-sky-900 border-sky-300";
    case "not_relevant":
    case "duplicate":
    case "invalid":
      return "bg-rose-100 text-rose-900 border-rose-300";
    default:
      return "bg-amber-100 text-amber-900 border-amber-300";
  }
}

export function ClinicIntelligencePanel({
  clinicId,
  clinicName,
  website,
  profile,
  loading,
  researching,
  onResearch,
  onRefresh,
  onPatched,
}: {
  clinicId: string;
  clinicName: string;
  website?: string | null;
  profile: ClinicIntelligenceProfile | null;
  loading?: boolean;
  researching?: boolean;
  onResearch: (force?: boolean) => void;
  onRefresh: () => void;
  onPatched: (profile: ClinicIntelligenceProfile) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  const [showAllTalk, setShowAllTalk] = useState(false);
  const [editSummary, setEditSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [focusDraft, setFocusDraft] = useState("");
  const [patching, setPatching] = useState(false);

  const speakingFacts = useMemo(
    () =>
      (profile?.notableFacts || []).filter(
        (f) => f.confidence === "high" || f.confidence === "medium",
      ),
    [profile?.notableFacts],
  );

  async function patch(action: string, edits?: Record<string, unknown>) {
    setPatching(true);
    try {
      const res = await fetch("/api/research/clinic", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, action, edits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return;
      }
      if (data.profile) onPatched(data.profile);
      toast.success("Intelligence updated");
      setEditSummary(false);
    } catch {
      toast.error("Network error");
    } finally {
      setPatching(false);
    }
  }

  if (loading) {
    return <p className="text-xs text-muted-foreground p-2">Loading clinic intelligence…</p>;
  }

  if (!profile || profile.researchStatus === "not_started") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2 text-xs">
        <p className="font-semibold text-amber-950 flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" /> Clinic intelligence has not been verified yet.
        </p>
        <p className="text-amber-900/80">
          Do not treat name-and-phone alone as enough context. Research the official website before
          leading with clinic-specific claims.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white"
            disabled={researching || !website}
            onClick={() => onResearch(false)}
          >
            <RefreshCw className={`size-3.5 mr-1 ${researching ? "animate-spin" : ""}`} />
            {researching ? "Researching…" : "Research Clinic"}
          </Button>
          {website && (
            <Button size="sm" variant="outline" className="h-8" asChild>
              <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noreferrer">
                <Globe className="size-3.5 mr-1" /> Open Website
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8" disabled={patching} onClick={() => void patch("mark_not_relevant")}>
            Mark Not Relevant
          </Button>
        </div>
        {!website && <p className="text-rose-700">No official website on file.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] capitalize ${fitBadge(profile.fitStatus)}`}>
          {(profile.fitStatus || "research_required").replace(/_/g, " ")}
        </Badge>
        <Badge variant="outline" className="text-[10px] capitalize">
          {profile.priority} priority
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          Research {profile.researchCompleteness}%
        </Badge>
        <Badge variant="outline" className="text-[10px] capitalize">
          {(profile.researchStatus || "").replace(/_/g, " ")}
        </Badge>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={researching} onClick={() => onResearch(true)}>
            <RefreshCw className={`size-3 mr-1 ${researching ? "animate-spin" : ""}`} /> Re-run
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={patching} onClick={() => void patch("approve")}>
            <CheckCircle2 className="size-3 mr-1" /> Approve
          </Button>
        </div>
      </div>

      {/* Who they are */}
      <section className="rounded-lg border p-3 space-y-2">
        <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wide">Who they are</p>
        {editSummary ? (
          <div className="space-y-2">
            <Textarea value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} className="text-xs min-h-20" />
            <div className="flex gap-1">
              <Button size="sm" className="h-7" disabled={patching} onClick={() => void patch("edit", { shortSummary: summaryDraft })}>
                Save summary
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditSummary(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-foreground">
            {profile.shortSummary || `${clinicName} — summary not yet verified.`}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          {profile.primaryCategory && <span>Category: {profile.primaryCategory}</span>}
          {(profile.services || []).length > 0 && (
            <span>Services: {profile.services.slice(0, 5).join(", ")}</span>
          )}
          <span>Location: {[profile.city, profile.state].filter(Boolean).join(", ") || "—"}</span>
          {(profile.careDelivery || []).length > 0 && (
            <span>Care: {profile.careDelivery.join(" / ")}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(profile.websiteUrl || website) && (
            <a
              className="inline-flex items-center gap-1 text-sky-700 hover:underline"
              href={(profile.websiteUrl || website)!.startsWith("http")
                ? (profile.websiteUrl || website)!
                : `https://${profile.websiteUrl || website}`}
              target="_blank"
              rel="noreferrer"
            >
              <Globe className="size-3" /> Website
            </a>
          )}
          {profile.bookingUrl && (
            <a className="inline-flex items-center gap-1 text-sky-700 hover:underline" href={profile.bookingUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" /> Booking
            </a>
          )}
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setSummaryDraft(profile.shortSummary || "");
              setEditSummary(true);
            }}
          >
            Edit summary
          </button>
        </div>
        {(profile.likelyDecisionMakers?.length || profile.leadership?.length || profile.providers?.length) ? (
          <p className="text-muted-foreground">
            People:{" "}
            {[...(profile.likelyDecisionMakers || []), ...(profile.leadership || []), ...(profile.providers || [])]
              .slice(0, 4)
              .map((p) => [p.name, p.title].filter(Boolean).join(" — "))
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        ) : null}
      </section>

      {/* Why Novalyte */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-1.5">
        <p className="font-bold uppercase text-[10px] text-emerald-800 tracking-wide">Why this clinic fits Novalyte</p>
        <p className="text-emerald-950 leading-relaxed">
          {profile.novalyteFitReason ||
            "Fit not yet explained — research services before implying directory relevance."}
        </p>
        {(profile.recommendedDirectoryCategories || []).length > 0 && (
          <p className="text-emerald-900/80">
            Directory categories: {profile.recommendedDirectoryCategories.join(", ")}
          </p>
        )}
      </section>

      {/* Conversation angle */}
      <section className="rounded-lg border p-3 space-y-2">
        <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wide flex items-center gap-1">
          <Target className="size-3" /> Best conversation angle
        </p>
        {focusDraft !== "" || false ? null : null}
        <p className="text-sm font-medium leading-relaxed">{profile.conversationFocus}</p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() => {
              const next = window.prompt("Edit conversation focus", profile.conversationFocus || "");
              if (next != null) void patch("edit", { conversationFocus: next });
            }}
          >
            Edit focus
          </Button>
        </div>
      </section>

      {/* Facts to mention */}
      <section className="rounded-lg border p-3 space-y-1.5">
        <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wide">Facts to mention</p>
        {speakingFacts.length === 0 ? (
          <p className="text-muted-foreground">No high/medium-confidence facts yet — keep the opener general.</p>
        ) : (
          <ul className="list-disc pl-4 space-y-1">
            {speakingFacts.slice(0, 4).map((f, i) => (
              <li key={`${i}-${f.text}`}>
                {f.text}
                <span className="text-muted-foreground"> · {f.confidence}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Talk track */}
      <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
        <p className="font-bold uppercase text-[10px] text-emerald-800 tracking-wide">Recommended opener</p>
        <p className="text-sm leading-relaxed text-emerald-950">
          {profile.personalizedOpening || profile.talkTrack?.frontDesk}
        </p>
        <p className="text-emerald-900/80">{profile.relevanceStatement || profile.talkTrack?.relevanceStatement}</p>
        <p className="font-medium text-emerald-950">{profile.talkTrack?.permissionRequest}</p>
        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-0" onClick={() => setShowAllTalk((v) => !v)}>
          {showAllTalk ? <ChevronUp className="size-3 mr-1" /> : <ChevronDown className="size-3 mr-1" />}
          {showAllTalk ? "Hide variants" : "Show gatekeeper / voicemail / follow-up / email"}
        </Button>
        {showAllTalk && (
          <div className="space-y-2 border-t pt-2 text-[11px]">
            {profile.talkTrack?.decisionMaker && (
              <div>
                <p className="font-semibold">Decision-maker</p>
                <p>{profile.talkTrack.decisionMaker}</p>
              </div>
            )}
            {profile.talkTrack?.gatekeeper && (
              <div>
                <p className="font-semibold">Gatekeeper</p>
                <p>{profile.talkTrack.gatekeeper}</p>
              </div>
            )}
            {profile.talkTrack?.voicemail && (
              <div>
                <p className="font-semibold">Voicemail</p>
                <p>{profile.talkTrack.voicemail}</p>
              </div>
            )}
            {profile.talkTrack?.followUp && (
              <div>
                <p className="font-semibold">Follow-up</p>
                <p>{profile.talkTrack.followUp}</p>
              </div>
            )}
            {profile.talkTrack?.emailTransition && (
              <div>
                <p className="font-semibold">Email transition</p>
                <p>{profile.talkTrack.emailTransition}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Questions */}
      <section className="rounded-lg border p-3 space-y-1.5">
        <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wide">Questions to verify</p>
        <ul className="list-disc pl-4 space-y-0.5">
          {(profile.verificationQuestions || []).map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>

      {/* Missing */}
      {(profile.missingInformation || []).length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1">
          <p className="font-bold uppercase text-[10px] text-amber-800 tracking-wide">Still missing</p>
          <ul className="list-disc pl-4 text-amber-950">
            {profile.missingInformation.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Sources */}
      <section className="rounded-lg border p-3 space-y-1.5">
        <button
          type="button"
          className="flex items-center gap-1 font-bold uppercase text-[10px] text-muted-foreground tracking-wide"
          onClick={() => setShowSources((v) => !v)}
        >
          Sources {showSources ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
        {showSources && (
          <div className="space-y-1.5">
            {(profile.sources || []).length === 0 && (
              <p className="text-muted-foreground">No stored sources yet.</p>
            )}
            {(profile.sources || []).map((s) => (
              <div key={s.id} className="border rounded px-2 py-1.5">
                <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline break-all">
                  {s.pageTitle || s.sourceUrl}
                </a>
                <p className="text-muted-foreground capitalize">
                  {s.sourceType.replace(/_/g, " ")} · {s.confidence}
                  {s.isOfficial ? " · official" : ""}
                </p>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={onRefresh}>
              Refresh sources
            </Button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={patching} onClick={() => void patch("mark_incorrect")}>
          Mark Incorrect
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={patching} onClick={() => void patch("mark_not_relevant")}>
          Mark Not Relevant
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={patching} onClick={() => void patch("mark_duplicate")}>
          Mark Duplicate
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={patching} onClick={() => void patch("mark_invalid")}>
          Mark Invalid
        </Button>
      </div>
    </div>
  );
}
