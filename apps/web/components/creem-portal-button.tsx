"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

interface CreemPortalButtonProps {
  customerId?: string | null;
  isDark?: boolean;
}

export function CreemPortalButton({ customerId, isDark = false }: CreemPortalButtonProps) {
  const [loading, setLoading] = useState(false);

  if (!customerId) {
    return (
      <button
        disabled
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 cursor-not-allowed ${isDark ? "bg-slate-700 text-slate-400 border-slate-600" : "bg-slate-300 text-slate-500 border-slate-400"}`}
      >
        <CreditCard className="w-4 h-4" />
        No Subscription
      </button>
    );
  }

  const handleOpenPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creem/portal");
      const data = await res.json();

      if (!res.ok || !data.portalUrl) {
        throw new Error(data.error || "Failed to open portal");
      }

      // Redirect to Creem's hosted portal
      window.location.href = data.portalUrl;
    } catch (err) {
      console.error("Portal error:", err);
      alert(err instanceof Error ? err.message : "Failed to open portal");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleOpenPortal}
      disabled={loading}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 border-slate-900 btn-action transition-colors ${isDark ? "bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-800/50" : "bg-slate-800 hover:bg-slate-700 text-white disabled:bg-slate-400"}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          Manage Subscription
        </>
      )}
    </button>
  );
}
