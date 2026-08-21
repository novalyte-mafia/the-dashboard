"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/admin/shared";
import { CONFIDENCE_LABELS, VERTICAL_LABELS } from "@/lib/outreach/labels";
import { RESEARCH_CONFIDENCES, VERTICALS } from "@/lib/outreach/types";
import type { SettingsResponse } from "./api";
import * as api from "./api";
import { Field } from "./shared";

export function SettingsView({
  data,
  onReload,
}: {
  data: SettingsResponse | null;
  onReload: () => void;
}) {
  if (!data) return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  const { settings, connectors, enforced } = data;

  async function patch(body: Record<string, unknown>) {
    try {
      await api.patchSettings(body);
      toast.success("Settings saved.");
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    }
  }

  return (
    <div className="grid gap-4">
      <SectionCard title="Meta Ads Library" description="Public advertising research. Secret values are never shown.">
        <p className="text-sm">
          Status: {connectors.find((row) => row.key === "meta_ad_library")?.configured ? "Connected (API key present)" : "Link-out only"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Set META_AD_LIBRARY_API_KEY for Ads Archive API access. Without it, Outreach still constructs the official library URL and records the job. It never invents ad cards.
        </p>
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              const result = await api.testConnector("meta_ad_library");
              toast.message(result.status === "ok" ? "Meta API key is present" : "Meta API not configured", {
                description: result.note ?? "Use the Meta Ads Library tab to search or open the official library.",
              });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Test failed.");
            }
          }}
        >
          Test Meta search configuration
        </Button>
      </SectionCard>

      <SectionCard title="Data Mode" description="Live production data only. Demo fixtures are not loaded.">
        <div className="grid gap-3">
          <ToggleRow
            label="Live connectors enabled"
            checked={settings.liveConnectorsEnabled}
            onChange={(checked) => void patch({ liveConnectorsEnabled: checked })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Research Sources" description="Configuration status only. Secret values are never shown.">
        <div className="grid gap-3">
          {connectors.map((connector) => (
            <div key={connector.key} className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{connector.label}</p>
                <p className="text-xs text-muted-foreground">
                  {connector.configured ? "Configured" : "Not configured"} · Last sync {connector.lastSync ?? "never"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Set {connector.env} on the server. Do not paste secrets here.</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(settings.enabledConnectors[connector.key])}
                  onCheckedChange={(checked) => void patch({ enabledConnectors: { [connector.key]: checked } })}
                  disabled={!connector.configured}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await api.testConnector(connector.key);
                      toast.message(result.status === "ok" ? "Connector configured" : "Connector not configured", {
                        description: result.note ?? "Live fetch is not run from this test.",
                      });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Test failed.");
                    }
                  }}
                >
                  Test connection
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Research Defaults">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Default vertical">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={settings.defaultVertical}
              onChange={(e) => void patch({ defaultVertical: e.target.value })}
            >
              {VERTICALS.map((item) => <option key={item} value={item}>{VERTICAL_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Default geography">
            <input className="h-9 rounded-md border px-2 text-sm" defaultValue={settings.defaultGeography} onBlur={(e) => void patch({ defaultGeography: e.target.value })} />
          </Field>
          <Field label="Default research confidence">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={settings.defaultResearchConfidence}
              onChange={(e) => void patch({ defaultResearchConfidence: e.target.value })}
            >
              {RESEARCH_CONFIDENCES.map((item) => <option key={item} value={item}>{CONFIDENCE_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Default owner">
            <input className="h-9 rounded-md border px-2 text-sm" defaultValue={settings.defaultOwnerId ?? ""} onBlur={(e) => void patch({ defaultOwnerId: e.target.value || null })} />
          </Field>
          <Field label="Source retention (days)">
            <input className="h-9 rounded-md border px-2 text-sm" type="number" defaultValue={settings.sourceRetentionDays} onBlur={(e) => void patch({ sourceRetentionDays: Number(e.target.value) })} />
          </Field>
          <Field label="Website recheck interval (days)">
            <input className="h-9 rounded-md border px-2 text-sm" type="number" defaultValue={settings.websiteRecheckDays} onBlur={(e) => void patch({ websiteRecheckDays: Number(e.target.value) })} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Drafting and send handoff" description="Two-pass research drafts. Humans still send or paste.">
        <ul className="text-sm space-y-1">
          <li>Pass 1 gathers public evidence and writes a first personalized draft.</li>
          <li>Pass 2 re-checks the contact route and evidence freshness (14 days) before Ready to Send.</li>
          <li>Published email → log Send from console. Contact form only → Copy message. Neither action auto-sends.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Compliance and Safety">
        <ul className="text-sm space-y-1 mb-3">
          <li>Only public business contact routes — <strong>enforced</strong> ({String(enforced.onlyPublicBusinessContactRoutes)})</li>
          <li>No automated sending — <strong>enforced</strong> ({String(enforced.noAutomatedSending)})</li>
          <li>No automated form submission — <strong>enforced</strong> ({String(enforced.noAutomatedFormSubmission)})</li>
        </ul>
        <div className="grid gap-3">
          <ToggleRow
            label="Require source URL for contact route"
            checked={settings.requireSourceUrlForContactRoute}
            onChange={(checked) => void patch({ requireSourceUrlForContactRoute: checked })}
          />
          <ToggleRow
            label="Require source evidence before Research Ready"
            checked={settings.requireEvidenceBeforeResearchReady}
            onChange={(checked) => void patch({ requireEvidenceBeforeResearchReady: checked })}
          />
          <Field label="Do Not Contact / Suppression policy">
            <Textarea defaultValue={settings.suppressionPolicy} rows={4} onBlur={(e) => void patch({ suppressionPolicy: e.target.value })} />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
