import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "user";

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

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setRole(data.role as AppRole);
        setHasAccess(true);
      } else {
        setRole(null);
        setHasAccess(false);
      }
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  const isAdmin = role === "admin";

  return { role, isAdmin, hasAccess, loading };
}
