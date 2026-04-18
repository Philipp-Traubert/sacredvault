import { createContext, useContext, useEffect, useState, type ReactNode, createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const SESSION_CACHE_KEY = "video_vault_session_user";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestAccess: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_CACHE_KEY);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate immediately from localStorage so airplane-mode reloads don't blank out
  const cached = typeof window !== "undefined" ? getCachedUser() : null;
  const [user, setUser] = useState<User | null>(cached);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setCachedUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? cached);
      if (s?.user) setCachedUser(s.user);
      setLoading(false);
    }).catch(() => {
      // offline — keep cached user, mark not loading
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    setCachedUser(null);
    try { localStorage.removeItem("video_vault_role_cache"); } catch { /* ignore */ }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const requestAccess = async (email: string, password: string) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) throw signUpError;

    const { error } = await supabase
      .from("access_requests")
      .insert({ email, status: "pending", user_id: signUpData.user?.id });
    if (error) throw error;

    await supabase.auth.signOut();
  };

  return createElement(
    AuthContext.Provider,
    { value: { user, session, loading, signIn, signOut, requestAccess } },
    children
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
