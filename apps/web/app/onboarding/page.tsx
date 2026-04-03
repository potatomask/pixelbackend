"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sprout, ContactRound } from "lucide-react";

const SOURCES = [
  { id: "google", label: "Google" },
  { id: "bing", label: "Bing" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "other", label: "Other" },
] as const;

const USE_CASES = [
  { id: "portfolio", label: "Portfolio" },
  { id: "landing_page", label: "Landing Page" },
  { id: "link_in_bio", label: "Link in Bio" },
  { id: "other", label: "Other" },
] as const;

function UsernameModal({ onDone }: { onDone: () => void }) {
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "saving">("idle");
  const [message, setMessage] = useState("");

  const checkHandle = async (val: string) => {
    if (!val || val.length < 3) {
      setStatus("taken");
      setMessage("At least 3 characters required.");
      return;
    }
    setStatus("checking");
    setMessage("Checking…");
    try {
      const res = await fetch(`/api/users/check-handle?handle=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.available) {
        setStatus("available");
        setMessage("Username is available!");
      } else {
        setStatus("taken");
        setMessage(data.reason === "reserved" ? "This username is reserved." : "Username already taken.");
      }
    } catch {
      setStatus("idle");
      setMessage("");
    }
  };

  const handleSave = async () => {
    if (status !== "available" || !handle) return;
    setStatus("saving");
    try {
      await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
    } catch {
      // non-fatal — user can change in profile settings
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/30">
          <ContactRound className="w-6 h-6 text-indigo-400" />
        </div>
        <h2 className="text-center text-xl font-bold text-white">Choose your username</h2>
        <p className="mt-1.5 text-center text-sm text-gray-400 mb-6">
          This becomes your public page URL — make it yours.
          <br />
          <span className="text-gray-500 text-xs">You can always change it in settings.</span>
        </p>

        <div className="relative flex items-center border-b-2 border-gray-600 focus-within:border-indigo-500 transition-colors mb-1">
          <span className="text-gray-400 font-mono text-lg mr-1">@</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
              setHandle(val);
              if (status !== "idle") { setStatus("idle"); setMessage(""); }
              clearTimeout((window as any).__handleTimer);
              (window as any).__handleTimer = setTimeout(() => checkHandle(val), 500);
            }}
            className="flex-1 bg-transparent py-2 outline-none text-xl text-white font-mono"
            placeholder="your_handle"
            maxLength={32}
          />
        </div>

        {message && (
          <p className={`text-xs mb-4 font-mono ${
            status === "available" ? "text-emerald-400" :
            status === "taken" ? "text-red-400" : "text-gray-400"
          }`}>{message}</p>
        )}
        {!message && <div className="mb-4" />}

        <div className="flex gap-3 mt-2">
          <button
            onClick={onDone}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={status !== "available"}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Saving…" : "Set Username"}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-600 font-mono">
          mypixel.page/<span className="text-gray-400">{handle || "username"}</span>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [source, setSource] = useState<string>("");
  const [sourceOther, setSourceOther] = useState("");
  const [useCase, setUseCase] = useState<string>("");
  const [useCaseOther, setUseCaseOther] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const router = useRouter();

  const isSourceValid = source !== "" && (source !== "other" || sourceOther.trim() !== "");
  const isUseCaseValid = useCase !== "" && (useCase !== "other" || useCaseOther.trim() !== "");

  async function handleSubmit() {
    if (!isSourceValid || !isUseCaseValid) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          sourceOther: source === "other" ? sourceOther : undefined,
          useCase,
          useCaseOther: useCase === "other" ? useCaseOther : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong");
      }
      setShowUsernameModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      {showUsernameModal && (
        <UsernameModal onDone={() => router.push("/dashboard")} />
      )}
      <div className="flex min-h-screen items-center justify-center bg-gray-950 py-12">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[310px] w-[310px] rounded-full bg-emerald-500 opacity-15 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6 rounded-2xl border border-gray-800/80 bg-gray-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
            <Sprout className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Welcome to MyPixelPage</h1>
          <p className="mt-1.5 text-sm text-gray-400">Quick question before you start building</p>
        </div>

        {/* Source */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
            How did you find us?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  source === s.id
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700/80 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {source === "other" && (
            <div>
              <input
                type="text"
                value={sourceOther}
                onChange={(e) => setSourceOther(e.target.value)}
                placeholder="Where did you find us? (required)"
                maxLength={200}
                className={`mt-1 w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors ${
                  sourceOther.trim() === ""
                    ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500"
                    : "border-gray-700 focus:border-emerald-500 focus:ring-emerald-500"
                }`}
              />
              {sourceOther.trim() === "" && (
                <p className="mt-1 text-xs text-rose-400">This field is required.</p>
              )}
            </div>
          )}
        </div>

        {/* Use Case */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
            What will you use MyPixelPage for?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {USE_CASES.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setUseCase(u.id)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  useCase === u.id
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700/80 hover:text-white"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
          {useCase === "other" && (
            <div>
              <input
                type="text"
                value={useCaseOther}
                onChange={(e) => setUseCaseOther(e.target.value)}
                placeholder="Describe your use case (required)"
                maxLength={200}
                className={`mt-1 w-full rounded-lg border bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-colors ${
                  useCaseOther.trim() === ""
                    ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500"
                    : "border-gray-700 focus:border-emerald-500 focus:ring-emerald-500"
                }`}
              />
              {useCaseOther.trim() === "" && (
                <p className="mt-1 text-xs text-rose-400">This field is required.</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isSourceValid || !isUseCaseValid || loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : (
            "Continue →"
          )}
        </button>
      </div>
    </div>
    </>
  );
}
