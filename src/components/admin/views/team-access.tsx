"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  SectionCard,
  LoadingState,
  DataTable,
  StatusBadge,
  EmptyState,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, ShieldCheck, Clock } from "lucide-react";
import { adminService } from "@/services";
import { ADMIN_ROLES, roleLabel } from "@/lib/constants";
import { initials, fullName, relativeTime, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { AdminMember } from "@/types";

// Permission matrix (read-only)
const PERMISSION_MATRIX = [
  { feature: "Clinics — view", roles: ["founder", "admin", "sales", "operations", "directory_reviewer"] },
  { feature: "Clinics — edit", roles: ["founder", "admin", "sales", "operations"] },
  { feature: "Calls — log", roles: ["founder", "admin", "sales", "operations"] },
  { feature: "Calls — view all", roles: ["founder", "admin", "operations"] },
  { feature: "Deals — manage", roles: ["founder", "admin", "sales"] },
  { feature: "Directory — review", roles: ["founder", "admin", "directory_reviewer"] },
  { feature: "Directory — approve", roles: ["founder", "admin", "directory_reviewer"] },
  { feature: "Patient Leads — route", roles: ["founder", "admin", "operations"] },
  { feature: "Settings — view", roles: ["founder", "admin"] },
  { feature: "Settings — edit", roles: ["founder"] },
  { feature: "Team — manage", roles: ["founder"] },
  { feature: "Audit Logs — view", roles: ["founder", "admin"] },
];

export function TeamAccessView() {
  const { refreshKey } = useNav();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminService.list().then((d) => setMembers(d)).finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div>
      <PageHeader
        title="Team Access"
        description="Manage team members, roles, and permissions"
        action={
          <Button onClick={() => toast.info("Invitations are sent by founder. Please contact Jamil Yakasai.")}>
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Invite Member</span>
          </Button>
        }
      />

      <Card className="p-0 mb-5">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Team Members</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{members.length} active accounts</p>
        </div>
        {loading ? (
          <LoadingState label="Loading team…" />
        ) : members.length === 0 ? (
          <EmptyState icon={UserPlus} title="No team members" />
        ) : (
          <DataTable
            data={members}
            columns={[
              {
                key: "name",
                header: "Member",
                render: (m) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials(m.firstName, m.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{fullName(m.firstName, m.lastName)}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                ),
                sortValue: (m) => `${m.firstName} ${m.lastName}`,
              },
              {
                key: "role",
                header: "Role",
                render: (m) => {
                  const tone =
                    m.role === "founder" ? "violet" :
                    m.role === "admin" ? "teal" :
                    m.role === "sales" ? "amber" :
                    m.role === "operations" ? "green" : "slate";
                  return <StatusBadge label={roleLabel(m.role)} color={tone} />;
                },
                sortValue: (m) => m.role,
              },
              {
                key: "status",
                header: "Status",
                render: (m) => (
                  <StatusBadge
                    label={m.status === "active" ? "Active" : m.status === "suspended" ? "Suspended" : "Revoked"}
                    color={m.status === "active" ? "green" : m.status === "suspended" ? "amber" : "rose"}
                  />
                ),
              },
              {
                key: "lastLogin",
                header: "Last Login",
                render: (m) => (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {relativeTime(m.lastLoginAt)}
                  </span>
                ),
                sortValue: (m) => m.lastLoginAt ?? "",
                hideOnMobile: true,
              },
              {
                key: "created",
                header: "Joined",
                render: (m) => <span className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>,
                sortValue: (m) => m.createdAt,
                hideOnMobile: true,
              },
            ]}
            pageSize={25}
          />
        )}
      </Card>

      <SectionCard title="Role Permission Matrix" description="Read-only — what each role can access">
        <div className="overflow-x-auto nv-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="font-medium text-muted-foreground px-3 py-2.5">Feature</th>
                {ADMIN_ROLES.map((r) => (
                  <th key={r.id} className="font-medium text-muted-foreground px-3 py-2.5 text-center whitespace-nowrap">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((p) => (
                <tr key={p.feature} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-3 py-2.5">{p.feature}</td>
                  {ADMIN_ROLES.map((r) => (
                    <td key={r.id} className="px-3 py-2.5 text-center">
                      {p.roles.includes(r.id) ? (
                        <ShieldCheck className="size-4 text-emerald-600 inline" />
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
