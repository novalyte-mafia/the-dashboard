import { OUTREACH_SUBVIEWS, type OutreachSubview } from "./types";

export const OUTREACH_DEFAULT_SUBVIEW: OutreachSubview = "overview";

/** User-facing name for the clinic acquisition / outreach workspace. */
export const OUTREACH_WORKSPACE_NAME = "Outreach";

export function resolveOutreachSubview(view: string | null | undefined): OutreachSubview {
  if (view && (OUTREACH_SUBVIEWS as readonly string[]).includes(view)) {
    return view as OutreachSubview;
  }
  return OUTREACH_DEFAULT_SUBVIEW;
}
