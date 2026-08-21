"use client";

import type { ReactNode } from "react";
import { StatusBadge } from "@/components/admin/shared";
import { CONTACT_FORM_PRIMARY_ACTION } from "@/lib/outreach/compliance";
import {
  AD_SIGNAL_LABELS,
  CHANNEL_BADGES,
  CHANNEL_LABELS,
  CONFIDENCE_LABELS,
  SOURCE_BADGES,
  STATUS_LABELS,
  VERTICAL_LABELS,
  statusColor,
} from "@/lib/outreach/labels";
import { externalLinkProps } from "@/lib/outreach/links";
import { HUMAN_REVIEW_NOTICE, SAFETY_NOTICE } from "@/lib/outreach/types";
import type {
  AdSignalStatus,
  ContactChannelType,
  ContactVerificationStatus,
  ProspectStatus,
  ResearchConfidence,
  SourceType,
} from "@/lib/outreach/types";
import { cn } from "@/lib/utils";

export function SafetyBanner() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {SAFETY_NOTICE}
    </div>
  );
}

export function HumanReviewNote() {
  return <p className="text-xs text-muted-foreground">{HUMAN_REVIEW_NOTICE}</p>;
}

export function SafeExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a {...externalLinkProps(href)} className={cn("text-teal-700 hover:underline", className)}>
      {children}
    </a>
  );
}

export function SourceBadge({ source }: { source: SourceType }) {
  return <StatusBadge label={SOURCE_BADGES[source]} color="teal" />;
}

export function StatusChip({ status }: { status: ProspectStatus }) {
  return <StatusBadge label={STATUS_LABELS[status]} color={statusColor(status)} />;
}

export function ConfidenceChip({ value }: { value: ResearchConfidence }) {
  const color = value === "HIGH" ? "green" : value === "MEDIUM" ? "teal" : value === "LOW" ? "amber" : "slate";
  return <StatusBadge label={CONFIDENCE_LABELS[value]} color={color} />;
}

export function AdSignalChip({ value }: { value: AdSignalStatus }) {
  const color =
    value === "ACTIVE_OBSERVED" ? "green" : value === "PREVIOUSLY_OBSERVED" ? "amber" : value === "NO_SIGNAL" ? "slate" : "teal";
  return <StatusBadge label={AD_SIGNAL_LABELS[value]} color={color} />;
}

export function ChannelBadge({ channel }: { channel: ContactChannelType }) {
  const color =
    channel === "NONE_FOUND" ? "slate" : channel === "PUBLISHED_EMAIL" ? "teal" : channel === "CONTACT_FORM" ? "violet" : "green";
  return <StatusBadge label={CHANNEL_BADGES[channel]} color={color} />;
}

export function ContactRouteSummaryBadge({
  summary,
}: {
  summary: "email" | "form" | "phone" | "multiple" | "none";
}) {
  const map = {
    email: { label: "EMAIL", color: "teal" },
    form: { label: "FORM", color: "violet" },
    phone: { label: "PHONE", color: "green" },
    multiple: { label: "MULTI", color: "teal" },
    none: { label: "No verified email — web form/manual route needed.", color: "slate" },
  } as const;
  return <StatusBadge label={map[summary].label} color={map[summary].color} />;
}

export function VerificationChip({ status }: { status: ContactVerificationStatus }) {
  const color =
    status === "LIKELY_DELIVERABLE" || status === "DOMAIN_ACCEPTS_MAIL" || status === "SYNTAX_VALID"
      ? "teal"
      : status === "DO_NOT_CONTACT" || status === "SUPPRESSED" || status === "BOUNCED" || status === "INVALID_FORMAT"
        ? "rose"
        : "slate";
  const labels: Record<ContactVerificationStatus, string> = {
    UNVERIFIED: "Unverified",
    SYNTAX_VALID: "Syntax valid",
    DOMAIN_ACCEPTS_MAIL: "Domain accepts mail",
    LIKELY_DELIVERABLE: "Likely deliverable",
    INVALID_FORMAT: "Invalid format",
    DOMAIN_MISSING: "Domain missing",
    BOUNCED: "Bounced",
    SUPPRESSED: "Suppressed",
    DO_NOT_CONTACT: "Do not contact",
  };
  return <StatusBadge label={labels[status]} color={color} />;
}

export function OpenContactFormLink({ href }: { href: string }) {
  return (
    <SafeExternalLink href={href} className="text-xs font-medium">
      {CONTACT_FORM_PRIMARY_ACTION}
    </SafeExternalLink>
  );
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function verticalLabel(value: string) {
  return VERTICAL_LABELS[value as keyof typeof VERTICAL_LABELS] ?? value;
}

export function channelLabel(channel: ContactChannelType) {
  return CHANNEL_LABELS[channel];
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
