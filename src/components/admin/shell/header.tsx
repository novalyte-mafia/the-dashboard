"use client";

import { useEffect, useState, useCallback } from "react";
import { useNav, AdminUser } from "@/components/admin/admin-app";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Search, Plus, Bell, LogOut, User as UserIcon, Settings as SettingsIcon,
  PhoneCall, Building2, Clock, ChevronRight, FileText, Users, ShoppingCart, PenTool,
} from "lucide-react";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { clinicService, notificationService } from "@/services";
import { appConfig } from "@/config/app-config";

const VIEW_TITLES: Record<string, { title: string; sub: string }> = {
  "overview": { title: "Executive Overview", sub: "What needs your attention today" },
  "priorities": { title: "Today's Priorities", sub: "Your prioritized action queue" },
  "revenue-overview": { title: "Revenue Overview", sub: "Pipeline, deals & revenue" },
  "operations-overview": { title: "Operations Overview", sub: "Platform health & ops" },
  "alerts": { title: "Alerts", sub: "Operational alerts" },
  "activity": { title: "Global Activity", sub: "Immutable activity history" },
  "clinics": { title: "Clinic Database", sub: "Pipeline CRM" },
  "clinic-detail": { title: "Clinic Profile", sub: "360-degree clinic record" },
  "call-queue": { title: "Outreach Queue", sub: "Founder outreach queue" },
  "call-console": { title: "Call Console", sub: "Live call workspace" },
  "follow-ups": { title: "Follow-Ups", sub: "Tasks & next actions" },
  "contacts": { title: "Contacts", sub: "All contacts across clinics" },
  "decision-makers": { title: "Decision-Makers", sub: "Key decision-maker records" },
  "campaigns": { title: "Outreach Campaigns", sub: "Campaign management" },
  "call-scripts": { title: "Call Scripts", sub: "Scripts & talk tracks" },
  "meetings": { title: "Meetings", sub: "Scheduled meetings" },
  "import-center": { title: "Import Center", sub: "Bulk clinic import" },
  "deals": { title: "Deals", sub: "Revenue opportunities" },
  "pipeline": { title: "Pipeline", sub: "Deal pipeline board" },
  "proposals": { title: "Proposals", sub: "Outstanding proposals" },
  "contracts": { title: "Contracts", sub: "Contract management" },
  "revenue": { title: "Revenue", sub: "Revenue tracking" },
  "payments": { title: "Payments", sub: "Payment processing" },
  "invoices": { title: "Invoices", sub: "Invoice management" },
  "conversion-analytics": { title: "Conversion Analytics", sub: "Sales conversion metrics" },
  "directory": { title: "Directory Listings", sub: "Listing operations" },
  "clinic-onboarding": { title: "Clinic Onboarding", sub: "Onboarding workflow" },
  "verification-queue": { title: "Verification Queue", sub: "Clinic verification" },
  "providers": { title: "Providers", sub: "Healthcare providers" },
  "treatments": { title: "Treatments", sub: "Treatment catalog" },
  "directory-analytics": { title: "Directory Analytics", sub: "Directory performance" },
  "patient-leads": { title: "Patient Leads", sub: "Lead management & routing" },
  "assessments": { title: "Assessments", sub: "Patient intake assessments" },
  "lead-routing": { title: "Lead Routing", sub: "Route leads to clinics" },
  "clinic-matching": { title: "Clinic Matching", sub: "Patient-to-clinic matching" },
  "patient-journey": { title: "Patient Journey", sub: "Lead lifecycle tracking" },
  "conversion-funnel": { title: "Conversion Funnel", sub: "Patient funnel analytics" },
  "demand-overview": { title: "Demand Overview", sub: "Market demand intelligence" },
  "geographic-demand": { title: "Geographic Demand", sub: "Demand by location" },
  "keyword-clusters": { title: "Keyword Clusters", sub: "Search keyword intelligence" },
  "rising-markets": { title: "Rising Markets", sub: "Fast-growing markets" },
  "coverage-gaps": { title: "Clinic Coverage Gaps", sub: "Underserved markets" },
  "campaign-dashboard": { title: "Campaign Dashboard", sub: "Advertising campaigns" },
  "campaign-builder": { title: "Campaign Builder", sub: "Create new campaigns" },
  "landing-pages": { title: "Landing Pages", sub: "Landing page management" },
  "creative-library": { title: "Creative Library", sub: "Ad creative assets" },
  "budget-management": { title: "Budget Management", sub: "Campaign budgets" },
  "lead-attribution": { title: "Lead Attribution", sub: "Source attribution" },
  "workforce-overview": { title: "Workforce Overview", sub: "Marketplace summary" },
  "professionals": { title: "Professional Profiles", sub: "Healthcare professionals" },
  "jobs": { title: "Job Listings", sub: "Open positions" },
  "applications": { title: "Job Applications", sub: "Application tracking" },
  "credentials": { title: "Credential Review", sub: "License & cert verification" },
  "workforce-analytics": { title: "Workforce Analytics", sub: "Hiring metrics" },
  "marketplace-overview": { title: "Marketplace Overview", sub: "Commerce summary" },
  "products": { title: "Products", sub: "Product catalog" },
  "orders": { title: "Orders", sub: "Order management" },
  "vendors": { title: "Vendors", sub: "Vendor management" },
  "marketplace-analytics": { title: "Marketplace Analytics", sub: "Commerce metrics" },
  "content-overview": { title: "Content Overview", sub: "Journal & content summary" },
  "articles": { title: "Articles", sub: "Article management" },
  "editorial-calendar": { title: "Editorial Calendar", sub: "Publishing schedule" },
  "content-studio": { title: "Content Studio", sub: "Article creation workspace" },
  "media-library": { title: "Media Library", sub: "Image & media assets" },
  "seo-briefs": { title: "SEO Briefs", sub: "Content briefs" },
  "content-performance": { title: "Content Performance", sub: "Content analytics" },
  "automation-overview": { title: "Automation Overview", sub: "Workflow summary" },
  "automations": { title: "Active Automations", sub: "Workflow management" },
  "ai-assistants": { title: "AI Assistants", sub: "AI agent configuration" },
  "call-intelligence": { title: "Call Intelligence", sub: "Call analysis & insights" },
  "lead-scoring": { title: "Lead Scoring", sub: "Scoring rules & models" },
  "failed-jobs": { title: "Failed Jobs", sub: "Automation failures" },
  "ai-cost-tracking": { title: "AI Cost Tracking", sub: "Model usage & costs" },
  "executive-analytics": { title: "Executive Analytics", sub: "High-level metrics" },
  "revenue-analytics": { title: "Revenue Analytics", sub: "Revenue trends" },
  "outreach-analytics": { title: "Outreach Analytics", sub: "Outreach performance" },
  "call-analytics": { title: "Call Analytics", sub: "Call performance" },
  "patient-analytics": { title: "Patient Analytics", sub: "Patient metrics" },
  "geographic-analytics": { title: "Geographic Analytics", sub: "Geo performance" },
  "live-website-activity": { title: "Live Website Activity", sub: "PostHog event stream" },
  "settings": { title: "User Account", sub: "Account & configuration" },
  "team-access": { title: "Team and Access", sub: "Team members & roles" },
  "integrations": { title: "Integrations", sub: "Connected services" },
  "audit-logs": { title: "Audit Logs", sub: "Security audit trail" },
  "feature-flags": { title: "Feature Flags", sub: "Feature toggles" },
  "app-health": { title: "Application Health", sub: "System status" },
};

interface SearchResult {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  primaryPhone?: string | null;
  generalEmail?: string | null;
}

export function AdminHeader({
  admin,
  onOpenLogCall,
}: {
  admin: AdminUser;
  onOpenLogCall: () => void;
}) {
  const { navigate, currentView } = useNav();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; isRead: boolean; priority?: string; createdAt: string }[]>([]);

  useEffect(() => {
    notificationService.list().then((d) => setNotifications(d.notifications ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await clinicService.search(query);
        setResults(data.results ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const unread = notifications.filter((n) => !n.isRead).length;
  const heading = VIEW_TITLES[currentView] ?? { title: "Novalyte Admin", sub: "Revenue Command Center" };

  const markAllRead = useCallback(() => {
    setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 shrink-0">
      <div className="h-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
        <div className="hidden sm:block min-w-0">
          <h2 className="text-sm font-semibold truncate">{heading.title}</h2>
          <p className="text-[11px] text-muted-foreground truncate">{heading.sub}</p>
        </div>

        {/* Search */}
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <div className="flex-1 max-w-md mx-auto">
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal h-9" onClick={() => setSearchOpen(true)}>
                <Search className="size-4" />
                <span className="hidden sm:inline">Search clinics, contacts, deals…</span>
                <span className="sm:hidden">Search…</span>
                <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent className="w-[420px] p-0" align="center">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Type a clinic, city, phone, email…" value={query} onValueChange={setQuery} />
              <CommandList className="max-h-80">
                <CommandEmpty>{loading ? "Searching…" : query ? "No matches found." : "Start typing to search."}</CommandEmpty>
                {results.length > 0 && (
                  <CommandGroup heading="Clinics">
                    {results.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.id}
                        onSelect={() => { setSearchOpen(false); navigate("clinic-detail", r.id); }}
                        className="flex items-start gap-2 py-2"
                      >
                        <Building2 className="size-4 mt-0.5 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[r.city, r.state].filter(Boolean).join(", ")}
                            {r.primaryPhone ? ` · ${r.primaryPhone}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!query && (
                  <CommandGroup heading="Quick Actions">
                    {[
                      { label: "Add Clinic", icon: Building2, action: () => navigate("clinics") },
                      { label: "Log Call", icon: PhoneCall, action: onOpenLogCall },
                      { label: "New Follow-Up", icon: Clock, action: () => navigate("follow-ups") },
                      { label: "Create Deal", icon: FileText, action: () => navigate("deals") },
                      { label: "Add Patient Lead", icon: Users, action: () => navigate("patient-leads") },
                      { label: "Create Article", icon: PenTool, action: () => navigate("content-studio") },
                      { label: "Build Campaign", icon: ShoppingCart, action: () => navigate("campaign-builder") },
                    ].map((a) => (
                      <CommandItem key={a.label} value={a.label} onSelect={() => { setSearchOpen(false); a.action(); }}>
                        <a.icon className="size-4 text-muted-foreground" />
                        <span>{a.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Global Data Source Pill */}
        {appConfig.dataMode === "live" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 text-[10px] font-bold shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            LIVE DB
          </div>
        )}
        {appConfig.dataMode === "hybrid" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-700 text-[10px] font-bold shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
            HYBRID MODE
          </div>
        )}
        {appConfig.dataMode === "demo" && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 text-[10px] font-bold animate-pulse shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
            </span>
            DEMO SANDBOX
          </div>
        )}

        {/* Quick Add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Quick Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenLogCall}><PhoneCall className="size-4" /> Log Call</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("clinics")}><Building2 className="size-4" /> New Clinic</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("follow-ups")}><Clock className="size-4" /> New Follow-Up</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("deals")}><FileText className="size-4" /> New Deal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("patient-leads")}><Users className="size-4" /> Add Patient Lead</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("content-studio")}><PenTool className="size-4" /> Create Article</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="size-4" />
              {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-card" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>}
            </div>
            <div className="max-h-80 overflow-y-auto nv-scroll">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={cn("px-3 py-2.5 border-b last:border-0", !n.isRead && "bg-primary/5")}>
                    <div className="flex items-start gap-2">
                      {n.priority === "critical" && <span className="size-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />}
                      {n.priority === "high" && <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {appConfig.brand.founder.initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{admin.firstName} {admin.lastName}</span>
                <span className="text-xs text-muted-foreground font-normal">{admin.email}</span>
                <span className="text-[10px] text-muted-foreground mt-1">{roleLabel(admin.role)}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("settings")}><UserIcon className="size-4" /> Account</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("team-access")}><Users className="size-4" /> Team & Access</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("integrations")}><SettingsIcon className="size-4" /> Integrations</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
