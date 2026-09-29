import type { Role } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  engineer: "Engineer",
  safety_officer: "Safety Officer",
  supervisor: "Supervisor",
  admin: "Admin",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
      {roleLabel(role)}
    </span>
  );
}
