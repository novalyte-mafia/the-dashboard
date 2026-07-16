"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, FilterBar, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Users, Building2, Phone, Mail, Crown, Star, ArrowRight, UserCheck, Linkedin,
} from "lucide-react";
import { clinicService } from "@/services";
import type { Clinic, ClinicContact } from "@/types";
import { formatPhone, fullName, relativeTime } from "@/lib/format";
import { CONTACT_TYPES, contactTypeLabel } from "@/lib/constants";
import { toast } from "sonner";

type ContactRow = ClinicContact & { clinicName: string; clinicCity?: string; clinicState?: string };

export function ContactsView() {
  const { openClinic, navigate, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    clinicService
      .list()
      .then((d) => setClinics(d.clinics))
      .catch(() => toast.error("Failed to load contacts"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const allContacts: ContactRow[] = useMemo(() => {
    const out: ContactRow[] = [];
    clinics.forEach((c) => {
      c.contacts.forEach((ct) => {
        out.push({
          ...ct,
          clinicName: c.name,
          clinicCity: c.city,
          clinicState: c.state,
        });
      });
    });
    return out;
  }, [clinics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allContacts.filter((c) => {
      if (q && !`${c.firstName} ${c.lastName} ${c.email ?? ""} ${c.directPhone ?? ""} ${c.mobilePhone ?? ""} ${c.clinicName} ${c.title ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeFilters.type && c.contactType !== activeFilters.type) return false;
      if (activeFilters.clinicId && c.clinicId !== activeFilters.clinicId) return false;
      if (activeFilters.dm === "yes" && !c.isDecisionMaker) return false;
      if (activeFilters.dm === "no" && c.isDecisionMaker) return false;
      return true;
    });
  }, [allContacts, search, activeFilters]);

  const dmCount = allContacts.filter((c) => c.isDecisionMaker).length;
  const primaryCount = allContacts.filter((c) => c.isPrimary).length;
  const withEmail = allContacts.filter((c) => c.email).length;
  const withPhone = allContacts.filter((c) => c.directPhone || c.mobilePhone).length;

  const clinicOptions = useMemo(() => clinics.map((c) => ({ value: c.id, label: c.name })), [clinics]);

  const columns: Column<ContactRow>[] = useMemo(() => [
    {
      key: "name",
      header: "Contact",
      render: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{fullName(c.firstName, c.lastName)}</p>
            {c.isDecisionMaker && (
              <Crown className="size-3.5 text-amber-500 shrink-0" />
            )}
            {c.isPrimary && (
              <Star className="size-3 text-violet-500 shrink-0" />
            )}
          </div>
          {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
        </div>
      ),
      sortValue: (c) => `${c.firstName} ${c.lastName}`,
    },
    {
      key: "clinic",
      header: "Clinic",
      render: (c) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{c.clinicName}</p>
          <p className="text-xs text-muted-foreground truncate">{[c.clinicCity, c.clinicState].filter(Boolean).join(", ")}</p>
        </div>
      ),
      sortValue: (c) => c.clinicName,
      hideOnMobile: true,
    },
    {
      key: "type",
      header: "Type",
      render: (c) => <StatusBadge label={contactTypeLabel(c.contactType)} color="slate" />,
      sortValue: (c) => c.contactType,
      hideOnMobile: true,
    },
    {
      key: "phone",
      header: "Phone",
      render: (c) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatPhone(c.directPhone ?? c.mobilePhone)}
        </span>
      ),
      sortValue: (c) => c.directPhone ?? c.mobilePhone ?? "",
      hideOnMobile: true,
    },
    {
      key: "email",
      header: "Email",
      render: (c) => c.email ? (
        <span className="text-sm text-muted-foreground truncate inline-flex items-center gap-1">
          <Mail className="size-3" /> <span className="truncate max-w-[160px]">{c.email}</span>
        </span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (c) => c.email ?? "",
      hideOnMobile: true,
    },
    {
      key: "dm",
      header: "DM?",
      render: (c) => c.isDecisionMaker ? <StatusBadge label="DM" color="amber" /> : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (c) => (c.isDecisionMaker ? 1 : 0),
    },
    {
      key: "lastContact",
      header: "Last Contact",
      render: (c) => <span className="text-xs text-muted-foreground">{c.lastContactedAt ? relativeTime(c.lastContactedAt) : "Never"}</span>,
      sortValue: (c) => c.lastContactedAt ?? "",
      hideOnMobile: true,
    },
  ], []);

  if (loading) return <LoadingState label="Loading contacts…" />;

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={`${allContacts.length} contacts across ${clinics.length} clinics`}
        action={
          <Button variant="outline" onClick={() => navigate("decision-makers")}>
            <Crown className="size-4" /> Decision-makers
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Contacts" value={allContacts.length} icon={Users} tone="teal" />
        <MetricCard label="Decision-Makers" value={dmCount} icon={Crown} tone="amber" onClick={() => navigate("decision-makers")} />
        <MetricCard label="Primary Contacts" value={primaryCount} icon={Star} tone="violet" />
        <MetricCard label="With Phone" value={withPhone} icon={Phone} tone="green" hint={`${withEmail} with email`} />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "type", label: "Type", options: CONTACT_TYPES.map((t) => ({ value: t.id, label: t.label })) },
          { key: "clinicId", label: "Clinic", options: clinicOptions },
          { key: "dm", label: "Decision-Maker", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
        ]}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search by name, email, phone, clinic…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Users}
            title="No contacts match"
            description="Try adjusting filters or search."
            action={<Button onClick={() => navigate("clinics")}>Browse clinics <ArrowRight className="size-4" /></Button>}
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(c) => openClinic(c.clinicId)}
            pageSize={25}
          />
        </SectionCard>
      )}
    </div>
  );
}
