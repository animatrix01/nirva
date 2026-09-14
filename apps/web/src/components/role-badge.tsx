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
    <span className="text-xs text-neutral-400">
      {roleLabel(role)}
    </span>
  );
}
