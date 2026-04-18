import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "user";

const ROLE_CACHE_KEY = "video_vault_role_cache";

interface AccessContextValue {
  role: AppRole | null;
  isAdmin: boolean;
  hasAccess: boolean;
  loading: boolean;
}

const AccessContext = createContext<AccessContextValue | undefined>(undefined);

function getCachedRole(userId: string): AppRole | null {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.userId === userId) return parsed.role as AppRole;
  } catch { /* ignore */ }
  return null;
}

function setCachedRole(userId: string, role: AppRole) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role }));
  } catch { /* ignore */ }
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRole(null);
      setHasAccess(false);
      setLoading(false);
      return;
    }

    // Trust cache immediately. Never downgrade unless server explicitly says no.
    const cached = getCachedRole(user.id);
    if (cached) {
      setRole(cached);
      setHasAccess(true);
      setLoading(false);
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          // Network/transient error — keep cached state if any, never demote
          if (!cached) {
            setRole(null);
            setHasAccess(false);
            setLoading(false);
          }
          return;
        }

        if (data) {
          const r = data.role as AppRole;
          setRole(r);
          setHasAccess(true);
          setCachedRole(user.id, r);
        } else if (!cached) {
          // Only revoke if no cache AND server explicitly says no role
          setRole(null);
          setHasAccess(false);
        }
        setLoading(false);
      } catch {
        if (!cached) {
          setRole(null);
          setHasAccess(false);
          setLoading(false);
        }
      }
    })();
  }, [user, authLoading]);

  const isAdmin = role === "admin";

  return createElement(
    AccessContext.Provider,
    { value: { role, isAdmin, hasAccess, loading } },
    children
  );
}

export function useAccessControl(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccessControl must be used within AccessProvider");
  return ctx;
}
