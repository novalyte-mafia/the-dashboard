"use client";

import { useEffect, useState } from "react";
import { useNav, ViewId, AdminUser } from "@/components/admin/admin-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, Plus, Bell, LogOut, User as UserIcon, Settings as SettingsIcon, PhoneCall, Building2, Clock, ChevronRight } from "lucide-react";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";

const VIEW_TITLES: Record<ViewId, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "What needs your attention today" },
  clinics: { title: "Clinics", sub: "Pipeline CRM" },
  "clinic-detail": { title: "Clinic", sub: "Record" },
  "call-queue": { title: "Call Queue", sub: "Founder outreach queue" },
  "follow-ups": { title: "Follow-Ups", sub: "Tasks & next actions" },
  deals: { title: "Deals", sub: "Revenue opportunities" },
  directory: { title: "Directory", sub: "Listing operations" },
  activity: { title: "Activity", sub: "Immutable history" },
  settings: { title: "Settings", sub: "Account & configuration" },
};

interface SearchResult {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  primaryPhone?: string | null;
  generalEmail?: string | null;
  contactName?: string | null;
  type: "clinic" | "contact";
}

export function AdminHeader({
  admin,
  onOpenLogCall,
}: {
  admin: AdminUser;
  onOpenLogCall: () => void;
}) {
  const { navigate, view } = useNav();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; isRead: boolean; createdAt: string }[]>([]);

  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => setNotifications(d.notifications ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clinics/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const unread = notifications.filter((n) => !n.isRead).length;
  const heading = VIEW_TITLES[view] ?? VIEW_TITLES.overview;

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));
  }

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
                <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent className="w-[420px] p-0" align="center">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Type a clinic, city, phone, email…" value={query} onValueChange={setQuery} />
              <CommandList className="max-h-80">
                <CommandEmpty>{loading ? "Searching…" : query ? "No matches found." : "Start typing to search."}</CommandEmpty>
                {results.length > 0 && (
                  <CommandGroup heading="Results">
                    {results.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={r.id}
                        onSelect={() => {
                          setSearchOpen(false);
                          navigate("clinic-detail", r.id);
                        }}
                        className="flex items-start gap-2 py-2"
                      >
                        <Building2 className="size-4 mt-0.5 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[r.city, r.state].filter(Boolean).join(", ")}
                            {r.primaryPhone ? ` · ${r.primaryPhone}` : ""}
                            {r.generalEmail ? ` · ${r.generalEmail}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

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
            <DropdownMenuItem onClick={onOpenLogCall}>
              <PhoneCall className="size-4" />
              Log Call
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("clinics")}>
              <Building2 className="size-4" />
              New Clinic
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("follow-ups")}>
              <Clock className="size-4" />
              New Follow-Up
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="size-4.5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-card" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto nv-scroll">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={cn("px-3 py-2.5 border-b last:border-0", !n.isRead && "bg-primary/5")}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
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
                  {initials(admin.firstName, admin.lastName)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{admin.firstName} {admin.lastName}</span>
                <span className="text-xs text-muted-foreground font-normal">{admin.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("settings")}>
              <UserIcon className="size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("settings")}>
              <SettingsIcon className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.reload();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
