"use client";

import {
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
const BLANK: Form = {
  username: "",
  full_name: "",
  password: "",
  role: "user",
  is_active: true,
};

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
      (u) => !k || `${u.full_name} ${u.username}`.toLowerCase().includes(k)
    );
  }, [users, q]);

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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Pengguna"
        desc={`${users.length} akun terdaftar. Atur peran, status, dan kata sandi.`}
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

      <div className="mb-3 space-y-2">
        {error && <Notice kind="error">{error}</Notice>}
        {ok && <Notice kind="success">{ok}</Notice>}
      </div>

      <div className="relative mb-3">
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

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d9d9d9] px-4 py-8 text-center text-sm text-[#6b6b6b]">
          Tidak ada akun yang cocok.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#e6e6e6] bg-white p-3 transition hover:border-[#c9c9c9]"
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${
                  u.is_active ? "bg-[#202020]" : "bg-[#b5b5b5]"
                }`}
              >
                {u.full_name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {u.full_name}
                  </span>
                  <Badge tone={u.role === "admin" ? "dark" : "neutral"}>
                    {u.role === "admin" ? "Admin" : "User"}
                  </Badge>
                  <Badge tone={u.is_active ? "green" : "red"}>
                    {u.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </p>
                <p className="truncate text-xs text-[#6b6b6b]">
                  @{u.username} · login terakhir {fmtDate(u.last_login_at)}
                </p>
              </div>
              <div className="ml-auto flex gap-1.5">
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
                  className={`${BTN_GHOST} w-9 px-0 hover:border-[#D71920] hover:text-[#D71920]`}
                  aria-label={`Hapus ${u.username}`}
                  disabled={u.id === me?.id}
                  onClick={() => remove(u)}
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
