"use client";

import {
  CaretDown,
  ChartLineUp,
  List,
  MapTrifold,
  Question,
  ShieldCheck,
  SignOut,
  UploadSimple,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Flag } from "./Brand";
import { PlaceSearch } from "./PlaceSearch";
import { Spinner } from "./ui";

const GENERAL = [
  { href: "/peta-saya", label: "Peta", icon: MapTrifold },
  { href: "/dashboard", label: "Statistik", icon: ChartLineUp },
  { href: "/faq", label: "Panduan", icon: Question },
];

const ADMIN = [
  { href: "/upload-peta", label: "Upload", icon: UploadSimple },
  { href: "/admin", label: "Administrasi", icon: ShieldCheck },
  { href: "/admin/users", label: "Pengguna", icon: UsersThree },
];

type NavItem = (typeof GENERAL)[number];

/* Foto profil. Kalau backend nanti menyediakan avatar_url, otomatis tampil. */
function Avatar({ src, size = 34 }: { src?: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-[#e0e0e0]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0 rounded-full ring-1 ring-[#e0e0e0]"
    >
      <rect width="40" height="40" fill="#ececec" />
      <circle cx="20" cy="16" r="6.5" fill="#b3b3b3" />
      <path d="M6.5 40c0-8.2 6-13 13.5-13s13.5 4.800 13.5 13z" fill="#b3b3b3" />
    </svg>
  );
}

/* Menu: label "berputar naik" saat hover, garis bawah merah untuk halaman aktif. */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="group relative flex h-full items-center gap-1.5 px-0.5 text-[13px] font-medium text-[#202020] focus-visible:outline-none"
    >
      <Icon
        size={17}
        weight="light"
        className="transition-colors duration-300 group-hover:text-[#D71920]"
      />
      <span className="relative block h-[1.3em] overflow-hidden leading-[1.3em]">
        <span
          className={`block transition-transform duration-300 ease-out group-hover:-translate-y-full ${
            active ? "font-semibold" : ""
          }`}
        >
          {item.label}
        </span>
        <span
          aria-hidden="true"
          className={`absolute left-0 top-full block text-[#D71920] transition-transform duration-300 ease-out group-hover:-translate-y-full ${
            active ? "font-semibold" : ""
          }`}
        >
          {item.label}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#D71920] transition-transform duration-300 ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Menu seluler menutup otomatis saat pindah halaman.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Tutup menu akun saat klik di luar atau tekan Esc.
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node))
        setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  if (loading) {
    return (
      <div className="grid h-screen place-items-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return null;

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const isAdmin = user.role === "admin";
  const navItems = [...GENERAL, ...(isAdmin ? ADMIN : [])];
  const fullScreenMap = pathname === "/peta-saya";
  const avatarSrc = (user as { avatar_url?: string | null }).avatar_url;
  const roleLabel = isAdmin ? "Administrator" : "Pengguna";

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#202020]">
      <header className="sticky top-0 z-40 border-b border-[#e6e6e6] bg-white text-[#202020]">
        <div className="mx-auto grid h-14 max-w-[1800px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-3 lg:px-5">
          {/* Kiri: menu umum */}
          <div className="flex h-full items-center">
            <nav
              className="hidden h-full items-center gap-6 lg:flex"
              aria-label="Menu utama"
            >
              {GENERAL.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                />
              ))}
            </nav>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-md p-2 transition-colors hover:text-[#D71920] lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X size={20} weight="light" />
              ) : (
                <List size={20} weight="light" />
              )}
            </button>
          </div>

          {/* Tengah: bendera + judul platform */}
          <Link
            href="/peta-saya"
            className="flex items-center gap-2.5"
            aria-label="SIMPONI TP, ke halaman peta"
          >
            <Flag width={30} />
            <span className="leading-none">
              <span className="block text-[15px] font-bold tracking-tight">
                SIMPONI <span className="text-[#D71920]">TP</span>
              </span>
              <span className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.14em] text-[#6b6b6b] sm:block">
                Pertanian presisi UAV
              </span>
            </span>
          </Link>

          {/* Kanan: menu admin + akun */}
          <div className="flex h-full items-center justify-end gap-5">
            {isAdmin && (
              <nav
                className="hidden h-full items-center gap-6 lg:flex"
                aria-label="Menu admin"
              >
                {ADMIN.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                  />
                ))}
                <span className="h-5 w-px bg-[#e0e0e0]" aria-hidden="true" />
              </nav>
            )}

            {pathname === "/peta-saya" && <PlaceSearch />}

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="group flex items-center gap-2.5 rounded-full py-0.5 pl-0.5 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D71920]"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <Avatar src={avatarSrc} />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block max-w-[120px] truncate text-xs font-semibold">
                    {user.full_name}
                  </span>
                  <span className="block text-[10px] text-[#6b6b6b]">
                    {roleLabel}
                  </span>
                </span>
                <CaretDown
                  size={12}
                  weight="bold"
                  className={`hidden text-[#6b6b6b] transition-transform duration-300 group-hover:text-[#D71920] sm:block ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                role="menu"
                aria-hidden={!profileOpen}
                className={`absolute right-0 top-full mt-2 w-60 origin-top-right overflow-hidden rounded-lg border border-[#e6e6e6] bg-white shadow-[0_8px_28px_rgba(32,32,32,0.15)] transition-[transform,opacity,visibility] duration-[320ms] ease-apple ${
                  profileOpen
                    ? "visible scale-100 opacity-100"
                    : "pointer-events-none invisible scale-95 opacity-0"
                }`}
              >
                <div className="flex items-center gap-3 border-b border-[#efefef] px-3 py-3">
                  <Avatar src={avatarSrc} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {user.full_name}
                    </p>
                    <p className="truncate text-xs text-[#6b6b6b]">
                      @{user.username} · {roleLabel}
                    </p>
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-[#D71920] transition-colors hover:text-[#B8141A]"
                >
                  <SignOut size={16} weight="light" />
                  Keluar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Menu seluler: melayang di atas konten, tidak mendorongnya turun */}
        <div
          aria-hidden={!mobileOpen}
          onClick={() => setMobileOpen(false)}
          className={`fixed inset-x-0 bottom-0 top-14 bg-[#202020]/25 transition-opacity duration-[320ms] ease-apple lg:hidden ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <div
          className={`absolute inset-x-0 top-full origin-top border-b border-[#e6e6e6] bg-white p-2 shadow-[0_16px_32px_rgba(32,32,32,0.14)] transition-[transform,opacity,visibility] duration-[380ms] ease-apple lg:hidden ${
            mobileOpen
              ? "visible translate-y-0 opacity-100"
              : "pointer-events-none invisible -translate-y-3 opacity-0"
          }`}
        >
          <nav className="space-y-0.5" aria-label="Menu seluler">
            {navItems.map((item, i) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    transitionDelay: mobileOpen ? `${i * 30}ms` : "0ms",
                  }}
                  className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-[transform,opacity,color] duration-[380ms] ease-apple ${
                    mobileOpen
                      ? "translate-y-0 opacity-100"
                      : "-translate-y-1 opacity-0"
                  } ${
                    active
                      ? "border-[#D71920] font-semibold text-[#202020]"
                      : "border-transparent text-[#202020] hover:text-[#D71920]"
                  }`}
                >
                  <Icon size={18} weight="light" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main
        className={
          fullScreenMap
            ? "min-h-[calc(100vh-56px)]"
            : "min-h-[calc(100vh-56px)] px-4 py-6 lg:px-6"
        }
      >
        {children}
      </main>
    </div>
  );
}

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <div className="rounded-lg border border-[#D71920]/30 bg-white p-6">
        <h2 className="font-semibold text-[#D71920]">Akses ditolak</h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Halaman ini hanya untuk admin.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
