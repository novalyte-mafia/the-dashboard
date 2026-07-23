"use client";

import { useCallback, useRef } from "react";

type TelnyxCallLike = {
  hangup?: () => void;
  muteAudio?: () => void;
  unmuteAudio?: () => void;
  dtmf?: (digit: string) => void;
  remoteStream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  id?: string;
  telnyxCallControlId?: string;
  options?: { telnyxCallControlId?: string; id?: string };
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

type TelnyxClientLike = {
  connect: () => void;
  disconnect: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  newCall: (opts: Record<string, unknown>) => TelnyxCallLike;
};

export type FounderCallStatus =
  | "initiating"
  | "dialing"
  | "ringing"
  | "connected"
  | "completed"
  | "failed"
  | "canceled";

export type TelnyxFounderCallHandlers = {
  onStatus: (status: FounderCallStatus, extras?: { providerCallId?: string | null }) => void;
  onRemoteHangup?: () => void;
  onError?: (message: string) => void;
};

/**
 * Browser softphone for founder-led clinic calls via Telnyx WebRTC.
 * Audio plays in the browser (mic + speakers). Dialpad is not used.
 */
export function useTelnyxFounderCall() {
  const clientRef = useRef<TelnyxClientLike | null>(null);
  const callRef = useRef<TelnyxCallLike | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopRemoteAudio = useCallback(() => {
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.remove();
      } catch {
        /* ignore */
      }
      remoteAudioRef.current = null;
    }
  }, []);

  const stopMic = useCallback(() => {
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) track.stop();
      micStreamRef.current = null;
    }
  }, []);

  const attachRemoteAudio = useCallback(async (stream: MediaStream | null | undefined) => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    stopRemoteAudio();
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.srcObject = stream;
    document.body.appendChild(audio);
    remoteAudioRef.current = audio;
    try {
      await audio.play();
    } catch {
      // User gesture already happened on Call click; browsers may still block once.
    }
  }, [stopRemoteAudio]);

  const collectRemoteStream = useCallback((call: TelnyxCallLike): MediaStream | null => {
    const existing = call.remoteStream;
    if (existing?.getAudioTracks?.().some((t) => t.readyState !== "ended")) return existing;
    const pc = call.peerConnection;
    if (pc && typeof pc.getReceivers === "function") {
      const tracks = pc
        .getReceivers()
        .map((r) => r.track)
        .filter((t): t is MediaStreamTrack => Boolean(t && t.kind === "audio" && t.readyState !== "ended"));
      if (tracks.length > 0) return new MediaStream(tracks);
    }
    return null;
  }, []);

  const disconnectClient = useCallback(() => {
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch {
        /* ignore */
      }
      clientRef.current = null;
    }
  }, []);

  const hangup = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.hangup?.();
      } catch {
        /* ignore */
      }
      callRef.current = null;
    }
    stopRemoteAudio();
    stopMic();
    disconnectClient();
  }, [disconnectClient, stopMic, stopRemoteAudio]);

  const startOutbound = useCallback(
    async (
      destinationNumber: string,
      handlers: TelnyxFounderCallHandlers,
    ): Promise<{ ok: true; callerNumber: string } | { ok: false; error: string }> => {
      hangup();
      handlers.onStatus("initiating");

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          micStreamRef.current = stream;
        });
      } catch {
        return { ok: false, error: "Microphone permission is required for in-browser calling." };
      }

      const tokenRes = await fetch("/api/telephony/token");
      const tokenData = (await tokenRes.json().catch(() => ({}))) as {
        token?: string;
        callerNumber?: string;
        error?: string;
      };
      if (!tokenRes.ok || !tokenData.token || !tokenData.callerNumber) {
        stopMic();
        return {
          ok: false,
          error: tokenData.error || "Telnyx softphone is not configured. Set TELNYX_API_KEY, TELNYX_CREDENTIAL_ID, and TELNYX_PHONE_NUMBER.",
        };
      }

      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({ login_token: tokenData.token }) as unknown as TelnyxClientLike;
      clientRef.current = client;

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error("Telnyx softphone registration timed out.")),
            20000,
          );
          client.on("telnyx.ready", () => {
            window.clearTimeout(timeout);
            resolve();
          });
          client.on("telnyx.error", (err: unknown) => {
            window.clearTimeout(timeout);
            const message =
              err && typeof err === "object" && "message" in err
                ? String((err as { message?: string }).message)
                : "Telnyx line failed";
            reject(new Error(message));
          });
          client.connect();
        });
      } catch (error) {
        hangup();
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Could not register Telnyx softphone.",
        };
      }

      const call = client.newCall({
        destinationNumber,
        callerNumber: tokenData.callerNumber,
        localStream: micStreamRef.current,
        audio: true,
      });
      callRef.current = call;
      handlers.onStatus("dialing");

      call.on("ringing", () => {
        handlers.onStatus("ringing");
      });

      call.on("active", () => {
        const providerCallId =
          call.id ||
          call.telnyxCallControlId ||
          call.options?.telnyxCallControlId ||
          call.options?.id ||
          null;
        handlers.onStatus("connected", { providerCallId: providerCallId ? String(providerCallId) : null });
        const remote = collectRemoteStream(call);
        void attachRemoteAudio(remote);
        // Remote audio can arrive slightly after active.
        window.setTimeout(() => {
          void attachRemoteAudio(collectRemoteStream(call));
        }, 800);
      });

      call.on("hangup", () => {
        callRef.current = null;
        stopRemoteAudio();
        stopMic();
        disconnectClient();
        handlers.onStatus("completed");
        handlers.onRemoteHangup?.();
      });

      call.on("error", (err: unknown) => {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Call failed";
        handlers.onError?.(message);
        handlers.onStatus("failed");
        hangup();
      });

      return { ok: true, callerNumber: tokenData.callerNumber };
    },
    [attachRemoteAudio, collectRemoteStream, disconnectClient, hangup, stopMic, stopRemoteAudio],
  );

  const sendDtmf = useCallback((digit: string) => {
    try {
      callRef.current?.dtmf?.(digit);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    startOutbound,
    hangup,
    sendDtmf,
  };
}
