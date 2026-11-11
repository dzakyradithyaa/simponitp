"use client";

import { KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminOnly } from "@/components/Shell";
import { Modal, Notice, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

interface Form { id?: number; username: string; full_name: string; password: string; role: Role; is_active: boolean }
const BLANK: Form = { username: "", full_name: "", password: "", role: "user", is_active: true };

function Content() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(() => api.get<User[]>("/users").then(setUsers).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    try {
      if (form.id == null) {
        await api.post("/users", { username: form.username, full_name: form.full_name, password: form.password, role: form.role });
      } else {
        await api.patch(`/users/${form.id}`, { full_name: form.full_name, role: form.role, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) });
      }
      setForm(null); setOk(form.id == null ? "Akun dibuat." : "Akun diperbarui."); await load();
    } catch (err) { setFormError((err as Error).message); }
  }

  async function remove(u: User) {
    if (!confirm(`Hapus akun "${u.username}"? Polygon milik akun ini ikut terhapus.`)) return;
    setOk(null); setError(null);
    try { await api.del(`/users/${u.id}`); setOk("Akun dihapus."); await load(); } catch (err) { setError((err as Error).message); }
  }

  if (!users) return error ? <Notice kind="error">{error}</Notice> : <Spinner />;
  const editing = form?.id != null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Manajemen akun">
        <button className="btn-primary" onClick={() => { setForm(BLANK); setFormError(null); }}><UserPlus className="h-4 w-4" aria-hidden /> Tambah akun</button>
      </PageHeader>
      <div className="mb-4 space-y-2">{error && <Notice kind="error">{error}</Notice>}{ok && <Notice kind="success">{ok}</Notice>}</div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-army-200"><tr><th className="th">Nama</th><th className="th">Peran</th><th className="th">Status</th><th className="th">Login terakhir</th><th className="th"><span className="sr-only">Aksi</span></th></tr></thead>
          <tbody className="divide-y divide-army-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="td"><div className="font-medium">{u.full_name}</div><div className="text-xs text-army-600">{u.username}</div></td>
                <td className="td">{u.role === "admin" ? "Admin" : "User"}</td>
                <td className="td">{u.is_active ? "Aktif" : <span className="text-alert">Nonaktif</span>}</td>
                <td className="td">{fmtDate(u.last_login_at)}</td>
                <td className="td">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost px-2 py-1" onClick={() => { setForm({ id: u.id, username: u.username, full_name: u.full_name, password: "", role: u.role, is_active: u.is_active }); setFormError(null); }}><Pencil className="h-4 w-4" aria-hidden /> Ubah</button>
                    <button className="btn-danger px-2 py-1" aria-label={`Hapus ${u.username}`} disabled={u.id === me?.id} onClick={() => remove(u)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={editing ? `Ubah ${form.username}` : "Tambah akun"} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-3">
            {formError && <Notice kind="error">{formError}</Notice>}
            {!editing && <div><label className="field-label" htmlFor="u">Username</label><input id="u" className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required pattern="[a-zA-Z0-9._\-]{3,32}" title="3-32 karakter: huruf, angka, titik, garis bawah, atau strip" autoCapitalize="none" /></div>}
            <div><label className="field-label" htmlFor="fn">Nama lengkap</label><input id="fn" className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} /></div>
            <div>
              <label className="field-label" htmlFor="pw">{editing ? "Password baru (kosongkan bila tidak diganti)" : "Password"}</label>
              <div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-army-500" aria-hidden /><input id="pw" type="password" className="input pl-9" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={8} autoComplete="new-password" /></div>
              <p className="mt-1 text-xs text-army-600">Minimal 8 karakter.{editing && " Mengganti password mengeluarkan akun dari semua sesi."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label" htmlFor="r">Peran</label><select id="r" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} disabled={form.id === me?.id}><option value="user">User</option><option value="admin">Admin</option></select></div>
              {editing && <div><label className="field-label" htmlFor="s">Status</label><select id="s" className="input" value={form.is_active ? "1" : "0"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })} disabled={form.id === me?.id}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></div>}
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={() => setForm(null)}>Batal</button><button className="btn-primary">Simpan</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function UsersPage() { return <AdminOnly><Content /></AdminOnly>; }
