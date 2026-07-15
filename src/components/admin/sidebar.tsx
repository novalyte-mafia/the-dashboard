"use client";

import { useState } from "react";
import { useNav, ViewId } from "@/components/admin/admin-app";
import { LogoMark } from "@/components/admin/shared";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Building2,
  PhoneCall,
  CalendarCheck,
  TrendingUp,
  Globe2,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeft,
  Menu,
  LogOut,
} from "lucide-react";
import { initials } from "@/lib/format";

const NAV_ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "clinics", label: "Clinics", icon: Building2 },
  { id: "call-queue", label: "Call Queue", icon: PhoneCall },
  { id: "follow-ups", label: "Follow-Ups", icon: CalendarCheck },
  { id: "deals", label: "Deals", icon: TrendingUp },
  { id: "directory", label: "Directory", icon: Globe2 },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  currentView,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentView: ViewId;
}) {
  const { admin, navigate } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 h-16 px-4 border-b border-sidebar-border shrink-0", collapsed && "justify-center px-2")}>
        <div className="size-8 rounded-lg bg-sidebar-primary/10 flex items-center justify-center ring-1 ring-sidebar-primary/20 shrink-0">
          <LogoMark className="size-5 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">Novalyte Admin</p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">Revenue Command</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto nv-scroll px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.id || (currentView === "clinic-detail" && item.id === "clinics");
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.id);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <div className={cn("flex items-center gap-2.5 rounded-md p-2", collapsed && "justify-center")}>
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-xs font-semibold">
              {initials(admin.firstName, admin.lastName)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{admin.firstName} {admin.lastName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{roleLabel(admin.role)}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full mt-1 text-muted-foreground hover:text-foreground", collapsed && "px-2")}
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.reload();
          }}
        >
          <LogOut className="size-4" />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden lg:flex shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <div className="flex flex-col w-full">
          {content}
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center gap-2 h-9 border-t border-sidebar-border text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            {collapsed ? <PanelLeft className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* Mobile */}
      <div className="lg:hidden flex items-center">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {content}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
