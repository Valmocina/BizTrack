// Gatekeeper: shows a spinner while checking the session, the login form when signed out,
// and an "access denied" message when the user's role does not match.
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoginForm } from "@/features/auth/LoginForm";
import type { Role } from "@/types";

export function ProtectedRoute({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading, signOut } = useAuth();

  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-slate-400">Loading...</div>;
  if (!user) return <LoginForm />;
  if (role && user.role !== role) {
    return (
      <div className="grid min-h-screen place-items-center p-4 text-center">
        <div className="card p-6">
          <p className="text-sm font-semibold text-slate-800">You do not have access to this page.</p>
          <button className="btn-secondary mx-auto mt-4" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
