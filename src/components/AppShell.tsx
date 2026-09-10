"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Cpu,
  Camera,
  BadgeCheck,
  Zap,
  Boxes,
  ShieldCheck,
  Car,
  Sofa,
  FileCode2,
  Wrench,
  ClipboardList,
  Users,
  Building2,
  Trash2,
  UserCog,
  Settings,
  Search,
  LogOut,
} from "lucide-react";

// Deliberately mirrors the previous system's sidebar grouping (Asset
// Categories, then a Preventive Setup entry, then a Management
// section) — per the project's "jo cheez rakhne ki kahi hai, rakho"
// instruction, this structure was working and well-understood, so it
// isn't being redesigned for its own sake. What's different: this
// reads its nav from real category/module data at the page level in
// later passes — this first pass renders the same fixed set the old
// screenshots showed, to get something real on screen quickly.
const ASSET_CATEGORIES = [
  { label: "IT Assets", href: "/assets?category=it", icon: Cpu },
  { label: "Camera/NVR", href: "/assets?category=camera", icon: Camera },
  { label: "Quality Assets", href: "/assets?category=quality", icon: BadgeCheck },
  { label: "Electrical Assets", href: "/assets?category=electrical", icon: Zap },
  { label: "Production Assets", href: "/assets?category=production", icon: Boxes },
  { label: "Safety Assets", href: "/assets?category=safety", icon: ShieldCheck },
  { label: "Vehicle Assets", href: "/assets?category=vehicle", icon: Car },
  { label: "Furniture Assets", href: "/assets?category=furniture", icon: Sofa },
  { label: "Software/License", href: "/assets?category=software", icon: FileCode2 },
  { label: "Maintenance Assets", href: "/assets?category=maintenance", icon: Wrench },
];

const MANAGEMENT = [
  { label: "Employees", href: "/employees", icon: Users },
  { label: "HR Operations", href: "/hr", icon: Building2 },
  { label: "Damaged / Scrap", href: "/damaged-scrap", icon: Trash2 },
  { label: "User Management", href: "/users", icon: UserCog },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({
  children,
  userEmail,
  userRole,
}: {
  children: React.ReactNode;
  userEmail: string;
  userRole: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <aside className="flex w-64 shrink-0 flex-col border-r border-surface-border bg-white">
        <div className="flex items-center gap-3 border-b border-surface-border px-5 py-4">
          <Image src="/pg-logo.png" alt="PG" width={36} height={36} className="h-9 w-9 object-contain" />
          <div>
            <p className="text-sm font-semibold text-ink-900">A.E.M.S</p>
            <p className="text-[11px] text-ink-400">Asset Management</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavItem href="/dashboard" label="Dashboard" icon={LayoutGrid} active={pathname === "/dashboard"} />

          <p className="mb-1 mt-5 px-2 text-[11px] font-semibold tracking-wide text-ink-400">ASSET CATEGORIES</p>
          {ASSET_CATEGORIES.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
          <NavItem
            href="/maintenance"
            label="Preventive Setup"
            icon={ClipboardList}
            active={pathname?.startsWith("/maintenance") ?? false}
          />

          <p className="mb-1 mt-5 px-2 text-[11px] font-semibold tracking-wide text-ink-400">MANAGEMENT</p>
          {MANAGEMENT.map((item) => (
            <NavItem key={item.href} {...item} active={pathname?.startsWith(item.href) ?? false} />
          ))}
        </nav>

        <div className="border-t border-surface-border p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink-900">{userEmail}</p>
              <p className="text-[11px] uppercase tracking-wide text-ink-400">{userRole.replace("_", " ")}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-600 hover:bg-surface-muted"
            >
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-surface-border bg-white px-6 py-3">
          <div className="relative max-w-md flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Search assets, serial, employee…" />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-accent/10 font-medium text-accent" : "text-ink-600 hover:bg-surface-muted"
      }`}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
}
