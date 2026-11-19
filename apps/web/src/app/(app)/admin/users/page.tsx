"use client";

import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  Key,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UserPlus,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminOnly } from "@/components/Shell";
import {
  Badge,
  BTN_GHOST,
  BTN_PRIMARY,
  FOCUS,
  INPUT,
  LABEL,
  Modal,
  Notice,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { api, fmtDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

interface Form {
  id?: number;
  username: string;
  full_name: string;
  password: string;
  role: Role;
  is_active: boolean;
}
type SortKey = "account" | "role" | "status" | "created_at" | "last_login_at";
const BLANK: Form = {
  username: "",
  full_name: "",
  password: "",
  role: "user",
  is_active: true,
};

function AccountStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "border-[#256b4a] bg-[#256b4a] text-white"
          : "border-[#f0c4c6] bg-[#fff4f4] text-[#A3121A]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-white" : "bg-[#D71920]"
        }`}
      />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr rounded-lg bg-[#f1f1f1] p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`h-8 rounded-md text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} ${
            value === o.v
              ? "bg-white text-[#202020] shadow-sm"
              : "text-[#6b6b6b] hover:text-[#202020]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Content() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "account",
    direction: "asc",
  });
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api
        .get<User[]>("/users")
        .then(setUsers)
        .catch((e) => setError(e.message)),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (!k || `${u.full_name} ${u.username}`.toLowerCase().includes(k))
    ).sort((a, b) => {
      let result = 0;
      switch (sort.key) {
        case "account":
          result =
            a.full_name.localeCompare(b.full_name, "id", { sensitivity: "base" }) ||
            a.username.localeCompare(b.username);
          break;
        case "role":
          result = a.role.localeCompare(b.role);
          break;
        case "status":
          result = Number(!a.is_active) - Number(!b.is_active);
          break;
        case "created_at":
          result = a.created_at.localeCompare(b.created_at);
          break;
        case "last_login_at":
          if (!a.last_login_at || !b.last_login_at) {
            if (!a.last_login_at && !b.last_login_at)
              return a.username.localeCompare(b.username);
            return a.last_login_at ? -1 : 1;
          }
          result = a.last_login_at.localeCompare(b.last_login_at);
          break;
      }
      return sort.direction === "asc" ? result : -result;
    });
  }, [users, q, roleFilter, sort]);

  const sortHeader = (label: string, key: SortKey) => {
    const active = sort.key === key;
    return (
      <th
        key={key}
        scope="col"
        aria-sort={
          active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
        }
        className="px-4 py-3"
      >
        <button
          type="button"
          onClick={() =>
            setSort((current) => ({
              key,
              direction:
                current.key === key && current.direction === "asc" ? "desc" : "asc",
            }))
          }
          className={`inline-flex items-center gap-1 whitespace-nowrap text-left text-[11px] font-semibold transition hover:text-[#202020] ${FOCUS}`}
        >
          {label}
          {active ? (
            sort.direction === "asc" ? (
              <CaretUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CaretDown className="h-3.5 w-3.5" aria-hidden="true" />
            )
          ) : (
            <CaretUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
          )}
        </button>
      </th>
    );
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    try {
      if (form.id == null) {
        await api.post("/users", {
          username: form.username,
          full_name: form.full_name,
          password: form.password,
          role: form.role,
        });
      } else {
        await api.patch(`/users/${form.id}`, {
          full_name: form.full_name,
          role: form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        });
      }
      setForm(null);
      setOk(form.id == null ? "Akun dibuat." : "Akun diperbarui.");
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function remove(u: User) {
    if (
      !confirm(
        `Hapus akun "${u.username}"? Polygon milik akun ini ikut terhapus.`
      )
    )
      return;
    setOk(null);
    setError(null);
    try {
      await api.del(`/users/${u.id}`);
      setOk("Akun dihapus.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!users)
    return error ? <Notice kind="error">{error}</Notice> : <Spinner />;
  const editing = form?.id != null;

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-xs text-[#8a8a8a]">
        Administrasi <span aria-hidden="true">/</span> Akun
      </p>
      <PageHeader
        title={`Pengguna (${users.length})`}
        desc="Kelola peran dan status akun."
      >
        <button
          className={BTN_PRIMARY}
          onClick={() => {
            setForm(BLANK);
            setFormError(null);
          }}
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Tambah akun
        </button>
      </PageHeader>

      <div className="mb-4 space-y-2">
        {error && <Notice kind="error">{error}</Notice>}
        {ok && <Notice kind="success">{ok}</Notice>}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e6e6e6] bg-white">
        <div
          role="group"
          aria-label="Filter berdasarkan peran"
          className="flex gap-6 border-b border-[#e6e6e6] px-5"
        >
          {[
            { value: "all" as const, label: "Semua", count: users.length },
            {
              value: "admin" as const,
              label: "Admin",
              count: users.filter((u) => u.role === "admin").length,
            },
            {
              value: "user" as const,
              label: "User",
              count: users.filter((u) => u.role === "user").length,
            },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={roleFilter === tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={`-mb-px border-b-2 py-3 text-xs font-semibold transition ${FOCUS} ${
                roleFilter === tab.value
                  ? "border-[#D71920] text-[#202020]"
                  : "border-transparent text-[#8a8a8a] hover:text-[#202020]"
              }`}
            >
              {tab.label} <span className="ml-1 font-normal">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="relative w-full max-w-sm">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]"
              aria-hidden="true"
            />
            <input
              className={`${INPUT} pl-9`}
              placeholder="Cari nama atau username..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari akun"
            />
          </div>
          <p className="text-xs text-[#6b6b6b]" aria-live="polite">
            {shown.length} akun
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-[#fafafa] text-[11px] font-semibold text-[#6b6b6b]">
              <tr>
                {sortHeader("Akun", "account")}
                {sortHeader("Peran", "role")}
                {sortHeader("Status", "status")}
                {sortHeader("Terdaftar", "created_at")}
                {sortHeader("Login terakhir", "last_login_at")}
                <th scope="col" className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#6b6b6b]">
                    Tidak ada akun yang cocok.
                  </td>
                </tr>
              ) : (
                shown.map((u) => (
                  <tr key={u.id} className="transition hover:bg-[#fafafa]">
                    <td className="px-5 py-3">
                      <div className="flex min-w-52 items-center gap-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${u.is_active ? "bg-[#202020]" : "bg-[#b5b5b5]"}`}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[#202020]">{u.full_name}</span>
                          <span className="block truncate text-xs text-[#6b6b6b]">@{u.username}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "admin" ? "dark" : "neutral"}>
                        {u.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <AccountStatus active={u.is_active} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#4a4a4a]">{fmtDate(u.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6b6b6b]">
                      {u.last_login_at ? fmtDate(u.last_login_at) : "Belum pernah"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          className={`${BTN_GHOST} px-2.5`}
                          onClick={() => {
                            setForm({
                              id: u.id,
                              username: u.username,
                              full_name: u.full_name,
                              password: "",
                              role: u.role,
                              is_active: u.is_active,
                            });
                            setFormError(null);
                          }}
                        >
                          <PencilSimple className="h-4 w-4" aria-hidden="true" /> Ubah
                        </button>
                        <button
                          className={`${BTN_GHOST} px-2.5 text-[#D71920] hover:border-[#D71920]`}
                          aria-label={`Hapus ${u.username}`}
                          disabled={u.id === me?.id}
                          onClick={() => remove(u)}
                        >
                          <Trash className="h-4 w-4" aria-hidden="true" /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {form && (
        <Modal
          title={editing ? `Ubah ${form.username}` : "Tambah akun"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="space-y-3">
            {formError && <Notice kind="error">{formError}</Notice>}
            {!editing && (
              <div>
                <label className={LABEL} htmlFor="u">
                  Username
                </label>
                <input
                  id="u"
                  className={INPUT}
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  required
                  pattern="[a-zA-Z0-9._\-]{3,32}"
                  title="3-32 karakter: huruf, angka, titik, garis bawah, atau strip"
                  autoCapitalize="none"
                />
              </div>
            )}
            <div>
              <label className={LABEL} htmlFor="fn">
                Nama lengkap
              </label>
              <input
                id="fn"
                className={INPUT}
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                required
                maxLength={120}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pw">
                {editing
                  ? "Password baru (kosongkan bila tidak diganti)"
                  : "Password"}
              </label>
              <div className="relative">
                <Key
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]"
                  aria-hidden="true"
                />
                <input
                  id="pw"
                  type="password"
                  className={`${INPUT} pl-9`}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required={!editing}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#6b6b6b]">
                Minimal 8 karakter.
                {editing &&
                  " Mengganti password mengeluarkan akun dari semua sesi."}
              </p>
            </div>
            <div className={`grid gap-3 ${editing ? "grid-cols-2" : ""}`}>
              <div>
                <span className={LABEL}>Peran</span>
                <Segmented<Role>
                  value={form.role}
                  onChange={(role) => setForm({ ...form, role })}
                  disabled={form.id === me?.id}
                  options={[
                    { v: "user" as Role, label: "User" },
                    { v: "admin" as Role, label: "Admin" },
                  ]}
                />
              </div>
              {editing && (
                <div>
                  <span className={LABEL}>Status</span>
                  <Segmented<"1" | "0">
                    value={form.is_active ? "1" : "0"}
                    onChange={(v) => setForm({ ...form, is_active: v === "1" })}
                    disabled={form.id === me?.id}
                    options={[
                      { v: "1", label: "Aktif" },
                      { v: "0", label: "Nonaktif" },
                    ]}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className={`${BTN_GHOST} flex-1`}
                onClick={() => setForm(null)}
              >
                Batal
              </button>
              <button className={`${BTN_PRIMARY} flex-1`}>Simpan</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminOnly>
      <Content />
    </AdminOnly>
  );
}
