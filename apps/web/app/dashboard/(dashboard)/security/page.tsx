"use client";

import { useEffect, useState } from "react";
import { Shield, Key, Github, Mail, Loader2, Check, AlertCircle } from "lucide-react";

interface LinkedAccount {
  provider: string;
  accountId: string;
  linkedAt: string;
}

const PROVIDERS = [
  { id: "credential", label: "Email & Password", icon: Mail, color: "text-indigo-500", bg: "bg-indigo-100" },
  { id: "github", label: "GitHub", icon: Github, color: "text-slate-800", bg: "bg-slate-100" },
  { id: "google", label: "Google", icon: GoogleIcon, color: "text-red-500", bg: "bg-red-50" },
];

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function SecurityPage() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCredential, setHasCredential] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/users/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data.accounts || []);
        setHasCredential(
          (data.accounts || []).some((a: LinkedAccount) => a.provider === "credential")
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword.length < 8) {
      setPwMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (!currentPassword) {
      setPwMessage({ type: "error", text: "Current password is required." });
      return;
    }

    setChangingPw(true);
    try {
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      setPwMessage({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwMessage({ type: "error", text: err.message });
    } finally {
      setChangingPw(false);
    }
  };

  const linkedProviders = new Set(accounts.map((a) => a.provider));

  return (
    <div className="relative z-20">
      {/* Stamp */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 stamp border-rose-500/80 text-rose-500/80 rounded-lg px-4 sm:px-5 py-2 text-lg sm:text-xl font-black transform rotate-[6deg] font-mono bg-white/30 backdrop-blur-sm pointer-events-none tracking-widest select-none">
        SECURE
      </div>

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        Security
      </h2>
      <p className="text-slate-500 font-mono mb-10 text-sm">
        FILE: <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-xs">auth.config</span>
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 font-mono text-sm animate-pulse">
          Loading security info...
        </div>
      ) : (
        <div className="space-y-8 max-w-2xl">
          {/* Connected Accounts */}
          <div className="bg-white/60 p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-800 mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Connected Accounts
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Login methods linked to your account.
            </p>

            <div className="space-y-3">
              {PROVIDERS.map((provider) => {
                const Icon = provider.icon;
                const isLinked = linkedProviders.has(provider.id);
                const account = accounts.find((a) => a.provider === provider.id);

                return (
                  <div
                    key={provider.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isLinked
                        ? "border-slate-200 bg-white/80"
                        : "border-slate-100 bg-slate-50/50 opacity-50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${provider.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${provider.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800">{provider.label}</p>
                      {isLinked && account ? (
                        <p className="text-[10px] text-slate-500 font-mono">
                          Connected {new Date(account.linkedAt).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-mono">Not connected</p>
                      )}
                    </div>
                    <div>
                      {isLinked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded">
                          <Check className="w-3 h-3" /> Linked
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Change Password — only show if credential account exists */}
          {hasCredential && (
            <div className="bg-white/60 p-6 rounded-xl border border-slate-200">
              <h3 className="text-lg font-extrabold text-slate-800 mb-1 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Change Password
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                Update the password for your email login.
              </p>

              {pwMessage && (
                <div
                  className={`mb-4 p-3 rounded text-sm flex items-center gap-2 ${
                    pwMessage.type === "success"
                      ? "bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700"
                      : "bg-red-50 border-l-4 border-red-500 text-red-700"
                  }`}
                >
                  {pwMessage.type === "success" ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  {pwMessage.text}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-slate-500 font-black mb-1 font-mono uppercase tracking-wider text-xs">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-lg text-slate-800 transition-colors"
                    placeholder="Enter current password"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-black mb-1 font-mono uppercase tracking-wider text-xs">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-lg text-slate-800 transition-colors"
                    placeholder="Minimum 8 characters"
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-black mb-1 font-mono uppercase tracking-wider text-xs">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-lg text-slate-800 transition-colors"
                    placeholder="Re-enter password"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={changingPw}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl border-2 border-slate-800 btn-action uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
                  >
                    {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {changingPw ? "Changing..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!hasCredential && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 font-mono text-sm text-blue-800 rounded shadow-sm">
              <span className="font-bold uppercase">Note:</span>{" "}
              Password change is not available because you signed in with a social provider.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
