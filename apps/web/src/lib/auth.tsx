"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { SessionInfo, User } from "./types";

interface AuthState { user: User | null; loading: boolean; logout: () => Promise<void> }
const AuthContext = createContext<AuthState>({ user: null, loading: true, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const idleMs = useRef(3600 * 1000);
  const lastActivity = useRef(Date.now());
  const lastTouch = useRef(Date.now());

  const logout = useCallback(async (reason?: "expired") => {
    try { await api.post("/auth/logout"); } catch { /* already signed out */ }
    window.location.href = reason === "expired" ? "/login?expired=1" : "/login";
  }, []);

  useEffect(() => {
    api.get<SessionInfo>("/auth/me")
      .then((s) => { setUser(s.user); idleMs.current = s.idle_timeout_seconds * 1000; })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Session timeout: log out after the idle period; keep the server session alive while the person is active.
  useEffect(() => {
    if (!user) return;
    const mark = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = window.setInterval(() => {
      const now = Date.now();
      const idle = now - lastActivity.current;
      if (idle >= idleMs.current) return void logout("expired");
      const touchEvery = Math.min(idleMs.current / 4, 5 * 60 * 1000);
      if (idle < 60_000 && now - lastTouch.current > touchEvery) {
        lastTouch.current = now;
        api.get("/auth/me").catch(() => {});
      }
    }, 30_000);
    return () => { ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark)); window.clearInterval(timer); };
  }, [user, logout]);

  return <AuthContext.Provider value={{ user, loading, logout: () => logout() }}>{children}</AuthContext.Provider>;
}
