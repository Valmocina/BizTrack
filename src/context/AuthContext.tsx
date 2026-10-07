// Global auth state: the Supabase session plus the user's profile (name and role).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/services/supabaseClient";
import type { AuthUser, Role } from "@/types";

type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  // These return an error message (or a success message for resetPassword), or null when sign-in worked
  signIn: (email: string, password: string, remember: boolean) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({ user: null, loading: true, signIn: async () => null, resetPassword: async () => "", signOut: async () => {} });

const initialsOf = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");

// "Remember me" unchecked = stay signed in only until this browser tab is closed
const SESSION_ONLY = "biztrack-session-only";
const TAB_ACTIVE = "biztrack-tab-active";

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Track the Supabase session
  useEffect(() => {
    const start = async () => {
      if (localStorage.getItem(SESSION_ONLY) === "1" && !sessionStorage.getItem(TAB_ACTIVE)) {
        localStorage.removeItem(SESSION_ONLY);
        await supabase.auth.signOut();
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    void start();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Load the profile row whenever the signed-in user changes
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      setUser(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        const name = data?.full_name || data?.email || "";
        setUser(data ? { id: data.id, email: data.email, name, initials: initialsOf(name), role: data.role as Role } : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = async (email: string, password: string, remember: boolean) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    if (remember) {
      localStorage.removeItem(SESSION_ONLY);
    } else {
      localStorage.setItem(SESSION_ONLY, "1");
      sessionStorage.setItem(TAB_ACTIVE, "1");
    }
    return null;
  };

  // Sends a reset email; the link signs the person in so they can pick a new password in Settings
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return error ? error.message : "If that email has an account, a reset link is on its way.";
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user, loading, signIn, resetPassword, signOut }}>{children}</AuthContext.Provider>;
}

// Hook to read auth state from any component
export const useAuth = () => useContext(AuthContext);
