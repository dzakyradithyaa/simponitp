"use client";

import { CircleHelp, LayoutDashboard, LogOut, Map as MapIcon, Menu, ShieldCheck, Upload, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "./Brand";
import { Spinner } from "./ui";

const GENERAL = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/peta-saya", label: "Peta Saya", icon: MapIcon },
  { href: "/faq", label: "FAQ", icon: CircleHelp },
];
const ADMIN = [
  { href: "/upload-peta", label: "Upload Peta", icon: Upload },
  { href: "/admin", label: "Admin Panel", icon: ShieldCheck },
  { href: "/admin/users", label: "Manajemen Akun", icon: Users },
];

function NavLink({ href, label, icon: Icon, active, onClick }: (typeof GENERAL)[number] & { active: boolean; onClick: () => void }) {
  return (
    <Link
      href={href} onClick={onClick} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 border-l-4 px-4 py-2.5 text-[15px] font-medium transition-colors ${
        active ? "border-gold-500 bg-army-800 text-white" : "border-transparent text-khaki-200 hover:bg-army-800/60 hover:text-white"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden /> {label}
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="grid h-screen place-items-center"><Spinner /></div>;
  if (!user) return null; // the API client redirects to /login on 401

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));
  const close = () => setOpen(false);

  const nav = (
    <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto py-3">
      {GENERAL.map((n) => <NavLink key={n.href} {...n} active={isActive(n.href)} onClick={close} />)}
      {user.role === "admin" && (
        <>
          <div className="mx-4 mb-1 mt-5 border-t border-army-700 pt-3 text-xs font-medium text-army-300">Admin</div>
          {ADMIN.map((n) => <NavLink key={n.href} {...n} active={isActive(n.href)} onClick={close} />)}
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* fixed sidebar on desktop */}
      <aside className="chevron-field fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex">
        <div className="border-b border-army-700 px-4 py-5"><Wordmark light /></div>
        {nav}
        <UserBlock onLogout={logout} />
      </aside>

      {/* mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-army-900 px-4 py-3 lg:hidden">
        <Wordmark light />
        <button className="rounded p-2 text-khaki-100" aria-label={open ? "Tutup menu" : "Buka menu"} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 top-[68px] z-20 flex flex-col bg-army-900 lg:hidden">
          {nav}
          <UserBlock onLogout={logout} />
        </div>
      )}

      <main className="px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

function UserBlock({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="border-t border-army-700 p-4">
      <div className="truncate text-sm font-semibold text-white">{user.full_name}</div>
      <div className="mb-3 text-xs text-army-300">{user.role === "admin" ? "Admin" : "User"} · {user.username}</div>
      <button onClick={onLogout} className="btn w-full border border-army-600 text-khaki-100 hover:bg-army-800">
        <LogOut className="h-4 w-4" aria-hidden /> Keluar
      </button>
    </div>
  );
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <div className="card p-6"><h2>Akses ditolak</h2><p className="mt-1 text-army-700">Halaman ini hanya untuk admin.</p></div>;
  }
  return <>{children}</>;
}
