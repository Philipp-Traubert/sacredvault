import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "user";

const ROLE_CACHE_KEY = "video_vault_role_cache";

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

export function useAccessControl() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setHasAccess(false);
      setLoading(false);
      return;
    }

    // Use cached role immediately so offline works
    const cached = getCachedRole(user.id);
    if (cached) {
      setRole(cached);
      setHasAccess(true);
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!error && data) {
          setRole(data.role as AppRole);
          setHasAccess(true);
          setCachedRole(user.id, data.role as AppRole);
        } else if (!cached) {
          setRole(null);
          setHasAccess(false);
        }
      } catch {
        // Network error — keep cached role if available
        if (!cached) {
          setRole(null);
          setHasAccess(false);
        }
      }
      setLoading(false);
    };

    // If we have cache, stop loading immediately; still refresh in background
    if (cached) setLoading(false);
    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";

  return { role, isAdmin, hasAccess, loading };
}
