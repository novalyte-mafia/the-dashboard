"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneCall } from "lucide-react";

/**
 * Optional embedded Dialpad CTI (mini dialer), OFF by default.
 *
 * Requirements before this renders anything:
 * - NEXT_PUBLIC_DIALPAD_CTI_ENABLED=true (build-time public flag), and
 * - the server flag DIALPAD_CTI_ENABLED=true with a provisioned
 *   DIALPAD_CTI_CLIENT_ID (checked via the status endpoint; the client id is
 *   fetched server-side and only the iframe URL is exposed).
 *
 * Dialpad must provision the CTI client ID and allowlist this dashboard's
 * origin. See https://developers.dialpad.com/docs/dialpad-mini-dialer.
 * postMessage exchange follows the documented opencti_dialpad API with the
 * target origin pinned to https://dialpad.com (never "*").
 */

const DIALPAD_ORIGIN = "https://dialpad.com";
const PUBLIC_FLAG = process.env.NEXT_PUBLIC_DIALPAD_CTI_ENABLED === "true";

interface CtiMessage {
  api?: string;
  version?: string;
  method?: string;
  payload?: Record<string, unknown>;
}

export function DialpadCti({ phoneNumber, customData }: { phoneNumber?: string; customData?: string }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "unavailable" | "ready">("loading");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!PUBLIC_FLAG) {
      setState("unavailable");
      return;
    }
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/integrations/dialpad/cti");
        const data = await res.json();
        if (canceled) return;
        if (res.ok && data.clientId) {
          setClientId(data.clientId);
          setState("ready");
        } else {
          setState("unavailable");
        }
      } catch {
        if (!canceled) setState("unavailable");
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  // Validate origin on every inbound message; never trust arbitrary payloads.
  useEffect(() => {
    if (state !== "ready") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== DIALPAD_ORIGIN) return;
      const data = event.data as CtiMessage;
      if (!data || data.api !== "opencti_dialpad") return;
      if (data.method === "user_authentication") {
        setAuthenticated(Boolean(data.payload?.user_authenticated));
      }
      // call_ringing events surface in the panel via webhook-driven polling;
      // no client action needed here.
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [state]);

  const initiateCall = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !phoneNumber) return;
    iframeRef.current.contentWindow.postMessage(
      {
        api: "opencti_dialpad",
        version: "1.0",
        method: "initiate_call",
        payload: {
          enable_current_tab: true,
          phone_number: phoneNumber,
          ...(customData ? { custom_data: customData } : {}),
        },
      },
      DIALPAD_ORIGIN,
    );
  }, [phoneNumber, customData]);

  if (!PUBLIC_FLAG) return null;

  if (state === "loading") {
    return <Card className="p-3 text-xs text-muted-foreground">Loading embedded Dialpad…</Card>;
  }

  if (state === "unavailable" || !clientId) {
    return (
      <Card className="p-3 text-xs text-muted-foreground">
        Embedded Dialpad requires a CTI client ID and dashboard-origin approval from Dialpad.
      </Card>
    );
  }

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm flex items-center gap-1.5">
          <PhoneCall className="size-4" /> Embedded Dialpad
        </span>
        <div className="flex items-center gap-2">
          {authenticated === false && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
              Sign in to Dialpad below
            </Badge>
          )}
          {phoneNumber && authenticated && (
            <button className="text-xs underline" onClick={initiateCall}>
              Dial {phoneNumber}
            </button>
          )}
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={`${DIALPAD_ORIGIN}/apps/${encodeURIComponent(clientId)}`}
        title="Dialpad"
        allow="microphone; speaker-selection; autoplay; camera; display-capture; hid"
        sandbox="allow-popups allow-scripts allow-same-origin allow-forms"
        style={{ width: "100%", maxWidth: 420, height: 520, border: 0 }}
      />
    </Card>
  );
}
