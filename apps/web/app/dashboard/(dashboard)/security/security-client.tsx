"use client";

import { useState } from "react";
import { KeyRound, ShieldAlert, Smartphone } from "lucide-react";
import { useNotify } from "@/components/notifications";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useNotify();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    toast("info", "Password change not implemented yet but UI is ready!");
  };

  return (
    <div className="relative z-20">
      {/* Stamp */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 stamp border-amber-500/80 text-amber-500/80 rounded-lg px-4 sm:px-6 py-2 text-xl sm:text-2xl font-black transform -rotate-[8deg] font-[Space_Mono,monospace] bg-white/30 backdrop-blur-sm pointer-events-none tracking-widest select-none">
        SECURE
      </div>

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        Security Config
      </h2>
      <p className="text-slate-500 font-[Space_Mono,monospace] mb-10 text-sm">
        FILE: <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded text-xs">security.conf</span>
      </p>

      <div className="space-y-8 max-w-2xl">
        {/* Password Change */}
        <div className="bg-white/60 p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg border-2 border-blue-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-slate-800 font-[Space_Mono,monospace] uppercase tracking-wider text-sm">
              Change Password
            </h3>
          </div>

          <form className="space-y-4" onSubmit={handlePasswordChange}>
            <div>
              <label className="block text-slate-500 font-bold font-[Space_Mono,monospace] uppercase tracking-wider text-[10px] mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-lg text-slate-800 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-bold font-[Space_Mono,monospace] uppercase tracking-wider text-[10px] mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-lg text-slate-800 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="mt-2 bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold border-2 border-slate-800 btn-action hover:bg-slate-700 uppercase tracking-wider text-sm w-full"
            >
              Update Password
            </button>
          </form>
        </div>

        {/* 2FA */}
        <div className="bg-white/60 p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-purple-100 text-purple-600 rounded-lg border-2 border-purple-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-slate-800 font-[Space_Mono,monospace] uppercase tracking-wider text-sm">
              Two-Factor Auth
            </h3>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Add an additional layer of security to your account by requiring more than just a password to sign in.
          </p>

          <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl flex gap-4">
            <Smartphone className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-amber-900 mb-1 text-sm">Authenticator App</h4>
              <p className="text-xs text-amber-700 mb-3">
                Use an app like 1Password or Google Authenticator to generate one-time codes.
              </p>
              <button className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border-2 border-amber-700 btn-action transition-colors">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
