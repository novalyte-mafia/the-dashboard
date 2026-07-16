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
  LayoutDashboard, ListChecks, TrendingUp, Building2, PhoneCall, CalendarCheck,
  Users, Mail, FileText, DollarSign, CreditCard, BarChart3, Globe2, ShieldCheck,
  Stethoscope, MapPin, Megaphone, Briefcase, ShoppingCart, PenTool, Cpu,
  Activity as ActivityIcon, Settings as SettingsIcon, PanelLeftClose, PanelLeft,
  Menu, LogOut, ChevronDown, ChevronRight, type LucideIcon,
} from "lucide-react";
import { initials } from "@/lib/format";
import { appConfig } from "@/config/app-config";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
}
export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "command", label: "Command Center", icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
      { id: "priorities", label: "Today's Priorities", icon: ListChecks },
      { id: "revenue-overview", label: "Revenue Overview", icon: TrendingUp },
      { id: "operations-overview", label: "Operations Overview", icon: ActivityIcon },
      { id: "alerts", label: "Alerts", icon: ShieldCheck },
      { id: "activity", label: "Global Activity", icon: ActivityIcon },
    ],
  },
  {
    id: "acquisition", label: "Clinic Acquisition", icon: Building2,
    items: [
      { id: "clinics", label: "Clinic Database", icon: Building2 },
      { id: "call-queue", label: "Outreach Queue", icon: PhoneCall },
      { id: "call-console", label: "Call Console", icon: PhoneCall },
      { id: "follow-ups", label: "Follow-Ups", icon: CalendarCheck },
      { id: "contacts", label: "Contacts", icon: Users },
      { id: "decision-makers", label: "Decision-Makers", icon: Users },
      { id: "campaigns", label: "Outreach Campaigns", icon: Megaphone },
      { id: "call-scripts", label: "Call Scripts", icon: FileText },
      { id: "meetings", label: "Meetings", icon: CalendarCheck },
      { id: "import-center", label: "Import Center", icon: FileText },
    ],
  },
  {
    id: "sales", label: "Sales and Revenue", icon: DollarSign,
    items: [
      { id: "deals", label: "Deals", icon: DollarSign },
      { id: "pipeline", label: "Pipeline", icon: TrendingUp },
      { id: "proposals", label: "Proposals", icon: FileText },
      { id: "contracts", label: "Contracts", icon: FileText },
      { id: "revenue", label: "Revenue", icon: DollarSign },
      { id: "payments", label: "Payments", icon: CreditCard },
      { id: "invoices", label: "Invoices", icon: FileText },
      { id: "conversion-analytics", label: "Conversion Analytics", icon: BarChart3 },
    ],
  },
  {
    id: "network", label: "Clinic Network", icon: Globe2,
    items: [
      { id: "directory", label: "Directory Listings", icon: Globe2 },
      { id: "clinic-onboarding", label: "Clinic Onboarding", icon: Building2 },
      { id: "verification-queue", label: "Verification Queue", icon: ShieldCheck },
      { id: "providers", label: "Providers", icon: Stethoscope },
      { id: "treatments", label: "Treatments", icon: Stethoscope },
      { id: "directory-analytics", label: "Directory Analytics", icon: BarChart3 },
    ],
  },
  {
    id: "patients", label: "Patient Operations", icon: Users,
    items: [
      { id: "patient-leads", label: "Patient Leads", icon: Users },
      { id: "assessments", label: "Assessments", icon: FileText },
      { id: "lead-routing", label: "Lead Routing", icon: PhoneCall },
      { id: "clinic-matching", label: "Clinic Matching", icon: Building2 },
      { id: "patient-journey", label: "Patient Journey", icon: ActivityIcon },
      { id: "conversion-funnel", label: "Conversion Funnel", icon: BarChart3 },
    ],
  },
  {
    id: "demand", label: "Demand Intelligence", icon: MapPin,
    items: [
      { id: "demand-overview", label: "Demand Overview", icon: MapPin },
      { id: "geographic-demand", label: "Geographic Demand", icon: MapPin },
      { id: "keyword-clusters", label: "Keyword Clusters", icon: Search },
      { id: "rising-markets", label: "Rising Markets", icon: TrendingUp },
      { id: "coverage-gaps", label: "Clinic Coverage Gaps", icon: Globe2 },
    ],
  },
  {
    id: "growth", label: "Growth and Advertising", icon: Megaphone,
    items: [
      { id: "campaign-dashboard", label: "Campaign Dashboard", icon: Megaphone },
      { id: "campaign-builder", label: "Campaign Builder", icon: Megaphone },
      { id: "landing-pages", label: "Landing Pages", icon: Globe2 },
      { id: "creative-library", label: "Creative Library", icon: FileText },
      { id: "budget-management", label: "Budget Management", icon: DollarSign },
      { id: "lead-attribution", label: "Lead Attribution", icon: BarChart3 },
    ],
  },
  {
    id: "workforce", label: "Workforce", icon: Briefcase,
    items: [
      { id: "workforce-overview", label: "Workforce Overview", icon: Briefcase },
      { id: "professionals", label: "Professional Profiles", icon: Users },
      { id: "jobs", label: "Job Listings", icon: Briefcase },
      { id: "applications", label: "Job Applications", icon: FileText },
      { id: "credentials", label: "Credential Review", icon: ShieldCheck },
      { id: "workforce-analytics", label: "Workforce Analytics", icon: BarChart3 },
    ],
  },
  {
    id: "marketplace", label: "Marketplace", icon: ShoppingCart,
    items: [
      { id: "marketplace-overview", label: "Marketplace Overview", icon: ShoppingCart },
      { id: "products", label: "Products", icon: ShoppingCart },
      { id: "orders", label: "Orders", icon: FileText },
      { id: "vendors", label: "Vendors", icon: Building2 },
      { id: "marketplace-analytics", label: "Marketplace Analytics", icon: BarChart3 },
    ],
  },
  {
    id: "content", label: "Content and Journal", icon: PenTool,
    items: [
      { id: "content-overview", label: "Content Overview", icon: PenTool },
      { id: "articles", label: "Articles", icon: FileText },
      { id: "editorial-calendar", label: "Editorial Calendar", icon: CalendarCheck },
      { id: "content-studio", label: "Content Studio", icon: PenTool },
      { id: "media-library", label: "Media Library", icon: FileText },
      { id: "seo-briefs", label: "SEO Briefs", icon: Search },
      { id: "content-performance", label: "Content Performance", icon: BarChart3 },
    ],
  },
  {
    id: "automation", label: "Automation and AI", icon: Cpu,
    items: [
      { id: "automation-overview", label: "Automation Overview", icon: Cpu },
      { id: "automations", label: "Active Automations", icon: Cpu },
      { id: "ai-assistants", label: "AI Assistants", icon: Cpu },
      { id: "call-intelligence", label: "Call Intelligence", icon: PhoneCall },
      { id: "lead-scoring", label: "Lead Scoring", icon: BarChart3 },
      { id: "failed-jobs", label: "Failed Jobs", icon: ShieldCheck },
      { id: "ai-cost-tracking", label: "AI Cost Tracking", icon: DollarSign },
    ],
  },
  {
    id: "analytics", label: "Analytics", icon: BarChart3,
    items: [
      { id: "executive-analytics", label: "Executive Analytics", icon: BarChart3 },
      { id: "revenue-analytics", label: "Revenue Analytics", icon: DollarSign },
      { id: "outreach-analytics", label: "Outreach Analytics", icon: PhoneCall },
      { id: "call-analytics", label: "Call Analytics", icon: PhoneCall },
      { id: "patient-analytics", label: "Patient Analytics", icon: Users },
      { id: "geographic-analytics", label: "Geographic Analytics", icon: MapPin },
    ],
  },
  {
    id: "system", label: "System Administration", icon: SettingsIcon,
    items: [
      { id: "settings", label: "User Account", icon: SettingsIcon },
      { id: "team-access", label: "Team and Access", icon: Users },
      { id: "integrations", label: "Integrations", icon: Cpu },
      { id: "audit-logs", label: "Audit Logs", icon: ShieldCheck },
      { id: "feature-flags", label: "Feature Flags", icon: SettingsIcon },
      { id: "app-health", label: "Application Health", icon: ActivityIcon },
    ],
  },
];

export function Sidebar({
  collapsed, onToggleCollapse, currentView,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentView: ViewId;
}) {
  const { admin, navigate } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Expand the group containing the current view
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      if (g.items.some((i) => i.id === currentView)) init[g.id] = true;
    }
    // Also expand command center by default
    init["command"] = true;
    return init;
  });

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
      <nav className="flex-1 overflow-y-auto nv-scroll px-2 py-2">
        {NAV_GROUPS.map((group) => {
          const isExpanded = collapsed ? false : (expandedGroups[group.id] ?? false);
          const hasActive = group.items.some((i) => i.id === currentView || (currentView === "clinic-detail" && i.id === "clinics"));
          return (
            <div key={group.id} className="mb-1">
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors",
                    hasActive && "text-foreground"
                  )}
                >
                  <group.icon className="size-3.5" />
                  <span className="flex-1 text-left truncate">{group.label}</span>
                  {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
              )}
              {collapsed && (
                <div className="flex justify-center py-1">
                  <div className={cn("size-1 rounded-full", hasActive ? "bg-primary" : "bg-transparent")} />
                </div>
              )}
              {(isExpanded || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = currentView === item.id || (currentView === "clinic-detail" && item.id === "clinics");
                    return (
                      <button
                        key={item.id}
                        onClick={() => { navigate(item.id); setMobileOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          collapsed && "justify-center px-2",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className={cn("size-3.5 shrink-0", active && "text-sidebar-primary")} />
                        {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <div className={cn("flex items-center gap-2.5 rounded-md p-2", collapsed && "justify-center")}>
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-xs font-semibold">
              {appConfig.brand.founder.initials}
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
          variant="ghost" size="sm"
          className={cn("w-full mt-1 text-muted-foreground hover:text-foreground", collapsed && "px-2")}
          onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }}
        >
          <LogOut className="size-4" />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={cn("hidden lg:flex shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200", collapsed ? "w-[60px]" : "w-56")}>
        <div className="flex flex-col w-full">
          {content}
          <button
            onClick={onToggleCollapse}
            className="flex items-center justify-center gap-2 h-8 border-t border-sidebar-border text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            {collapsed ? <PanelLeft className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      <div className="lg:hidden flex items-center">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1"><Menu className="size-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {content}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

import { Search } from "lucide-react";
