"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  type LucideIcon,
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
  Menu,
  X,
  Activity,
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
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-frame flex min-h-screen bg-surface-muted">
      <div className={`nav-scrim ${navOpen ? "nav-scrim-visible" : ""}`} onClick={() => setNavOpen(false)} />
      <aside className={`app-sidebar ${navOpen ? "app-sidebar-open" : ""}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="brand-mark"><Image src="/pg-logo.png" alt="PG" width={36} height={36} className="h-9 w-9 object-contain" /></div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">A.E.M.S</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Operations control</p>
          </div>
          <button type="button" aria-label="Close navigation" className="ml-auto nav-close" onClick={() => setNavOpen(false)}><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="nav-kicker">Command center</p>
          <NavItem href="/dashboard" label="Dashboard" icon={LayoutGrid} active={pathname === "/dashboard"} onNavigate={() => setNavOpen(false)} />

          <p className="nav-kicker mt-6">Asset register</p>
          {ASSET_CATEGORIES.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} onNavigate={() => setNavOpen(false)} />
          ))}
          <NavItem
            href="/maintenance"
            label="Preventive Setup"
            icon={ClipboardList}
            active={pathname?.startsWith("/maintenance") ?? false}
            onNavigate={() => setNavOpen(false)}
          />

          <p className="nav-kicker mt-6">People & governance</p>
          {MANAGEMENT.map((item) => (
            <NavItem key={item.href} {...item} active={pathname?.startsWith(item.href) ?? false} onNavigate={() => setNavOpen(false)} />
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-navy-950">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{userEmail}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{userRole.replace("_", " ")}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="app-topbar flex items-center gap-3 border-b border-surface-border bg-white px-4 py-3 sm:px-6">
          <button type="button" aria-label="Open navigation" className="nav-open" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <div className="relative max-w-xl flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input search-input pl-9" placeholder="Search assets, serial, employee…" />
          </div>
          <div className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400 sm:flex"><Activity size={15} className="text-success" /> Live system</div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`nav-item mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "nav-item-active font-medium" : "text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
}
