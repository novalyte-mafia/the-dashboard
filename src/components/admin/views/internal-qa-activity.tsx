"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, LoadingState } from "@/components/admin/shared";
import { useNav } from "@/components/admin/admin-app";
import {
  clearInternalDeviceRegistration,
  persistInternalDeviceRegistration,
  readLocalInternalDeviceId,
} from "@/lib/analytics/internal-device-client";
import { toast } from "sonner";

type Device = {
  id: string;
  owner_email: string | null;
  label: string;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  first_registered_at: string;
  last_seen_at: string | null;
  status: "active" | "revoked";
};

export function InternalQaActivityView() {
  const { navigate } = useNav();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Jamil — Mac");
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null);
  const [internalVisitors, setInternalVisitors] = useState<number>(0);
  const [testConversions, setTestConversions] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, liveRes] = await Promise.all([
        fetch("/api/analytics/internal-devices", { cache: "no-store" }),
        fetch("/api/analytics/live?environment=production&traffic=internal", { cache: "no-store" }),
      ]);
      const devicesPayload = await devicesRes.json();
      const livePayload = await liveRes.json();
      setDevices(devicesPayload.devices ?? []);
      setInternalVisitors((livePayload.visitors ?? []).length);
      setLocalDeviceId(readLocalInternalDeviceId());

      const testRes = await fetch("/api/analytics/live?environment=production&traffic=test", {
        cache: "no-store",
      });
      const testPayload = await testRes.json();
      setTestConversions(Number(testPayload.metrics?.realConversions ?? testPayload.conversionsCount ?? 0));
      // For test traffic, use visitor/conversion counts from payload
      setTestConversions(
        (testPayload.visitors ?? []).reduce(
          (n: number, v: { conversionCount?: number }) => n + (v.conversionCount ?? 0),
          0,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load internal analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerCurrentBrowser() {
    try {
      const response = await fetch("/api/analytics/internal-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", label }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Registration failed");
      persistInternalDeviceRegistration({
        deviceId: payload.device.id,
        token: payload.token,
        label: payload.device.label,
      });
      setLocalDeviceId(payload.device.id);
      toast.success("This browser is marked internal for novalyte.io / ads.novalyte.io");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    }
  }

  async function revoke(deviceId: string) {
    const response = await fetch("/api/analytics/internal-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", deviceId }),
    });
    if (!response.ok) {
      toast.error("Revoke failed");
      return;
    }
    if (localDeviceId === deviceId) {
      clearInternalDeviceRegistration();
      setLocalDeviceId(null);
    }
    toast.success("Device revoked");
    await load();
  }

  if (loading && devices.length === 0) {
    return <LoadingState label="Loading internal & QA controls…" />;
  }

  return (
    <div>
      <PageHeader
        title="Internal & QA Activity"
        description="Register founder browsers, review internal sessions, and keep tests out of business metrics."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("live-website-activity")}>
              Live Activity
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">This browser</p>
          <p className="font-semibold mt-1">
            {localDeviceId ? `Registered · ${localDeviceId.slice(0, 8)}` : "Not registered"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Internal visitors (feed)</p>
          <p className="font-semibold mt-1 tabular-nums">{internalVisitors}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Test conversions (feed)</p>
          <p className="font-semibold mt-1 tabular-nums">{testConversions}</p>
        </Card>
      </div>

      <Card className="mb-4 p-4 space-y-3">
        <h3 className="font-semibold">Mark This Browser as Internal</h3>
        <p className="text-sm text-muted-foreground">
          Registers a first-party cookie on <code>.novalyte.io</code> so PostHog/GA events from this
          browser are classified internal. Does not use city/IP alone. Register Mac and Android
          separately.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="max-w-xs"
            placeholder="Jamil — Mac"
          />
          <Button onClick={() => void registerCurrentBrowser()}>Register Current Browser</Button>
          {localDeviceId && (
            <Button
              variant="outline"
              onClick={() => {
                clearInternalDeviceRegistration();
                setLocalDeviceId(null);
                toast.message("Local internal cookies cleared on this browser");
              }}
            >
              Clear local cookies
            </Button>
          )}
        </div>
        <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
          <li>Register this Mac browser here (label: Jamil — Mac).</li>
          <li>On Android: sign into admin, open this page, register as Jamil — Android.</li>
          <li>Visit novalyte.io — activity should appear under Internal only, not External.</li>
        </ol>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Registered internal devices</h3>
        </div>
        {devices.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No devices registered yet.</div>
        ) : (
          <div className="divide-y">
            {devices.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{d.label}</p>
                    <Badge variant={d.status === "active" ? "default" : "outline"}>{d.status}</Badge>
                    {localDeviceId === d.id && <Badge variant="secondary">This browser</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[d.device_type, d.browser, d.operating_system].filter(Boolean).join(" · ") ||
                      "Device details n/a"}
                    {" · "}
                    {d.owner_email || "owner unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    First · {new Date(d.first_registered_at).toLocaleString()}
                    {d.last_seen_at
                      ? ` · Last seen · ${new Date(d.last_seen_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                {d.status === "active" && (
                  <Button variant="outline" size="sm" onClick={() => void revoke(d.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
