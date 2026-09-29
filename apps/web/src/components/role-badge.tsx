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
    <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-neutral-300">
      {roleLabel(role)}
    </span>
  );
}
