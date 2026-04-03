"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface CreemCheckoutButtonProps {
  productId: string;
  label: string;
  isDark?: boolean;
  isCurrentPlan?: boolean;
  tier: "FREE" | "STARTER" | "PRO";
}

export function CreemCheckoutButton({
  productId,
  label,
  isDark,
  isCurrentPlan = false,
  tier,
}: CreemCheckoutButtonProps) {
  if (!productId) {
    return (
      <button
        disabled
        className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 cursor-not-allowed ${isDark ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-300 text-slate-600 border-slate-400"}`}
      >
        Configure Product
      </button>
    );
  }

  if (isCurrentPlan) {
    return (
      <button
        disabled
        className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 cursor-not-allowed ${isDark ? "bg-indigo-700 text-indigo-200 border-indigo-600" : "bg-indigo-300 text-indigo-800 border-indigo-400"}`}
      >
        Current Plan
      </button>
    );
  }

  return (
    <CreemCheckoutForm
      productId={productId}
      label={label}
      isDark={isDark}
      tier={tier}
    />
  );
}

function CreemCheckoutForm({
  productId,
  label,
  isDark,
  tier,
}: {
  productId: string;
  label: string;
  isDark?: boolean;
  tier: "FREE" | "STARTER" | "PRO";
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    // Store the tier being purchased so we can show the correct tier in the success modal
    sessionStorage.setItem("pendingTier", tier);
    try {
      const res = await fetch("/api/creem/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout");
        sessionStorage.removeItem("pendingTier");
      }

      // Redirect to Creem's hosted checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Checkout error:", err);
      alert(err instanceof Error ? err.message : "Checkout failed");
      sessionStorage.removeItem("pendingTier");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 btn-action transition-colors ${isDark ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-700 text-white disabled:bg-indigo-800" : "bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-700 disabled:bg-indigo-300"}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </span>
      ) : (
        label
      )}
    </button>
  );
}
