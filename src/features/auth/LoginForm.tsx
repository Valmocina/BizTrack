// Login screen: blank image panel on the left, email + password form on the right.
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";

export function LoginForm() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const message = await signIn(email.trim(), password, remember);
    if (message) setError(message);
    setBusy(false);
  };

  const forgot = async () => {
    setError("");
    if (!email.trim()) return setError("Enter your email first, then click Forgot password.");
    setInfo(await resetPassword(email.trim()));
  };

  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[38%] min-w-[260px] overflow-hidden md:block">
        <img src={`${import.meta.env.BASE_URL}login-visual.png`} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#091b2e]/80 via-[#091b2e]/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-white">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
            BizTrack
          </div>
          <p className="mt-4 max-w-xs text-2xl font-semibold leading-tight text-white">
            Smarter operations for every warehouse move.
          </p>
        </div>
      </div>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-[575px]">
          <div className="mb-14 flex items-center gap-3 text-[#10294d]">
            <Logo className="h-9 w-9 text-[#0b3d82]" />
            <span className="text-[28px] font-bold tracking-tight">BizTrack</span>
          </div>
          <h1 className="text-[32px] font-bold tracking-tight text-[#1f2d3f]">Welcome back!</h1>
          <p className="mt-2 text-base text-slate-400">Login to your account to continue.</p>

          <div className="mt-12 space-y-7">
            <label className="field"><span>Email</span>
              <input className="!h-14" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
            </label>
            <label className="field"><span>Password</span>
              <div className="relative">
                <input className="!h-14 pr-12" required type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
                  <Icon name={show ? "eyeoff" : "eye"} size={20} />
                </button>
              </div>
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 font-bold text-[#1f2d3f]">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#0b3d82]" /> Remember me
            </label>
            <button type="button" onClick={forgot} className="font-bold text-[#1a7cf0] hover:underline">Forgot password?</button>
          </div>

          {error && <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
          {info && <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{info}</div>}

          <button className="btn-primary mt-8 !h-14 w-full" type="submit" disabled={busy}>{busy ? "Logging in..." : "Login"}</button>
          <p className="mt-10 text-center text-xs text-slate-400">Don’t have an account? <span className="font-bold text-[#1a7cf0]">Contact your administrator.</span></p>
        </form>
      </main>
    </div>
  );
}
