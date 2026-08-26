import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<Role, string> = {
  engineer: "Engineer",
  safety_officer: "Safety Officer",
  supervisor: "Supervisor",
  admin: "Admin",
};

const ROLE_STYLES: Record<Role, string> = {
  engineer: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  safety_officer: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  supervisor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  admin: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export function RoleBadge({ role }: { role: string }) {
  const r = (role as Role) in ROLE_LABELS ? (role as Role) : null;
  return (
    <Badge variant="secondary" className={cn(r && ROLE_STYLES[r])}>
      {roleLabel(role)}
    </Badge>
  );
}
