"use client";

import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { Sidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { OverviewView } from "@/components/admin/views/overview";
import { ClinicsView } from "@/components/admin/views/clinics";
import { ClinicDetailView } from "@/components/admin/views/clinic-detail";
import { CallQueueView } from "@/components/admin/views/call-queue";
import { FollowUpsView } from "@/components/admin/views/follow-ups";
import { DealsView } from "@/components/admin/views/deals";
import { DirectoryView } from "@/components/admin/views/directory";
import { ActivityView } from "@/components/admin/views/activity";
import { SettingsView } from "@/components/admin/views/settings";
import { LogCallDialog } from "@/components/admin/log-call-dialog";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
};

export type ViewId =
  | "overview"
  | "clinics"
  | "clinic-detail"
  | "call-queue"
  | "follow-ups"
  | "deals"
  | "directory"
  | "activity"
  | "settings";

type NavState = {
  view: ViewId;
  clinicId: string | null;
};

type NavContextValue = {
  navigate: (view: ViewId, clinicId?: string | null) => void;
  openClinic: (clinicId: string) => void;
  openLogCall: (clinicId?: string, contactId?: string) => void;
  refreshKey: number;
  refresh: () => void;
  admin: AdminUser;
};

export const NavContext = createContext<NavContextValue | null>(null);

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within AdminApp");
  return ctx;
}

export function AdminApp({ admin }: { admin: AdminUser }) {
  const [nav, setNav] = useState<NavState>({ view: "overview", clinicId: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [logCall, setLogCall] = useState<{ clinicId?: string; contactId?: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigate = useCallback((view: ViewId, clinicId: string | null = null) => {
    setNav({ view, clinicId });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const openClinic = useCallback((clinicId: string) => {
    setNav({ view: "clinic-detail", clinicId });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const openLogCall = useCallback((clinicId?: string, contactId?: string) => {
    setLogCall({ clinicId, contactId });
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const ctx = useMemo(
    () => ({ navigate, openClinic, openLogCall, refreshKey, refresh, admin }),
    [navigate, openClinic, openLogCall, refreshKey, refresh, admin]
  );

  return (
    <NavContext.Provider value={ctx}>
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex flex-1 min-h-0">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            currentView={nav.view}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader
              admin={admin}
              onOpenLogCall={() => setLogCall({})}
            />
            <main className="flex-1 overflow-y-auto nv-scroll">
              <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
                <ViewRenderer nav={nav} />
              </div>
            </main>
          </div>
        </div>
        <footer className="border-t border-border/70 bg-card/50 py-3 px-6">
          <div className="mx-auto max-w-[1400px] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Novalyte Admin · Revenue Command Center · Release 1</span>
            <span className="flex items-center gap-3">
              <span>noindex · nofollow</span>
              <span className="hidden sm:inline">·</span>
              <span>Founders &amp; authorized ops only</span>
            </span>
          </div>
        </footer>

        {logCall && (
          <LogCallDialog
            open={!!logCall}
            onOpenChange={(o) => !o && setLogCall(null)}
            presetClinicId={logCall.clinicId}
            presetContactId={logCall.contactId}
            onLogged={() => {
              refresh();
            }}
          />
        )}

      </div>
    </NavContext.Provider>
  );
}

function ViewRenderer({ nav }: { nav: NavState }) {
  switch (nav.view) {
    case "overview":
      return <OverviewView />;
    case "clinics":
      return <ClinicsView />;
    case "clinic-detail":
      return nav.clinicId ? <ClinicDetailView clinicId={nav.clinicId} /> : <ClinicsView />;
    case "call-queue":
      return <CallQueueView />;
    case "follow-ups":
      return <FollowUpsView />;
    case "deals":
      return <DealsView />;
    case "directory":
      return <DirectoryView />;
    case "activity":
      return <ActivityView />;
    case "settings":
      return <SettingsView />;
    default:
      return <OverviewView />;
  }
}
