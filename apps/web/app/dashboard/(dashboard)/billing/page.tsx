"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { CheckCircle2, Loader2, Zap, Star, AlertCircle, X, Calendar, Sparkles } from "lucide-react";
import { CreemCheckoutButton } from "@/components/creem-checkout-button";
import { CreemPortalButton } from "@/components/creem-portal-button";
import {
  STORAGE_LIMITS_KEY,
  STORAGE_LIMITS,
  normalizeStorageLimits,
  formatStorageLimitLabel,
  type StorageLimitConfig,
} from "@/lib/storage";

type UserTier = "FREE" | "STARTER" | "PRO";

type SubscriptionStatus = {
  hasSubscription: boolean;
  subscriptionId?: string;
  status?: string;
  productId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  subscriptionStatus?: "none" | "active" | "canceled";
  tier: UserTier;
  creemCustomerId?: string | null;
};

const PLAN_FEATURES_BASE: Record<UserTier, string[]> = {
  FREE: [
    "350 Objects",
    "basic objects",
    "basic themes",
    "side links",
    "your own /username",
  ],
  STARTER: [
    "2500 Objects",
    "all objects",
    "all open themes",
    "side links",
    "your own /username",
    "hide pixel page tags",
  ],
  PRO: [
    "10000 Objects",
    "all objects",
    "all open themes",
    "side links",
    "your own /username",
    "hide pixel page tags",
  ],
};

const TIER_FULL_LABEL: Record<UserTier, string> = {
  FREE: "Free Tier",
  STARTER: "Starter Tier",
  PRO: "Pro Tier",
};

const STARTER_PRODUCT_ID = process.env.NEXT_PUBLIC_CREEM_STARTER_PRODUCT_ID || "";
const PRO_PRODUCT_ID = process.env.NEXT_PUBLIC_CREEM_PRO_PRODUCT_ID || "";

export default function BillingPage() {
  const [tier, setTier] = useState<UserTier>("FREE");
  const [loadingTier, setLoadingTier] = useState(true);
  const [creemCustomerId, setCreemCustomerId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingTier, setPendingTier] = useState<UserTier | null>(null);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [storageLimits, setStorageLimits] = useState<StorageLimitConfig>(STORAGE_LIMITS);
  const { theme } = useTheme();

  const isDark = theme === "dark" || theme === "system";

  // Check for success/canceled params from Creem redirect (only on mount)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const canceled = params.get("canceled");

    if (success === "true") {
      setError(null);
      // Clear the URL param so it doesn't show again on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.pathname);
      // Read the pending tier from sessionStorage (set before checkout redirect)
      const stored = sessionStorage.getItem("pendingTier") as UserTier | null;
      if (stored) {
        setPendingTier(stored);
        sessionStorage.removeItem("pendingTier");
      }
      void loadAllData().then(() => {
        setShowSuccessModal(true);
      });
    } else if (canceled === "true") {
      setError("Checkout was canceled.");
      // Clear the URL param too
      const url = new URL(window.location.href);
      url.searchParams.delete("canceled");
      window.history.replaceState({}, "", url.pathname);
    } else {
      // Normal load
      void loadAllData();
    }
  }, []); // Only run once on mount

  useEffect(() => {
    fetch(`/api/settings/${STORAGE_LIMITS_KEY}`)
      .then((r) => r.json())
      .then((data: { value: string | null }) => {
        if (!data.value) {
          setStorageLimits(STORAGE_LIMITS);
          return;
        }
        setStorageLimits(normalizeStorageLimits(JSON.parse(data.value)));
      })
      .catch(() => setStorageLimits(STORAGE_LIMITS));
  }, []);

  const loadAllData = async () => {
    // Load user profile
    try {
      const res = await fetch("/api/users/profile", { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        const nextTier = data?.user?.tier as UserTier;
        const customerId = data?.user?.creemCustomerId;
        if (nextTier === "FREE" || nextTier === "STARTER" || nextTier === "PRO") {
          setTier(nextTier);
          setCreemCustomerId(customerId || null);
        }
      }
    } finally {
      setLoadingTier(false);
    }

    // Load subscription status
    await fetchSubscriptionStatus();
  };

  const fetchSubscriptionStatus = async () => {
    setLoadingSubscription(true);
    try {
      const res = await fetch("/api/creem/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      const data = await res.json();
      setSubscription(data);
    } catch (err) {
      console.error("Subscription fetch error:", err);
      setSubscription({ hasSubscription: false, tier });
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleCancelSubscription = async (reason: string, comment: string) => {
    setCanceling(true);
    try {
      // Submit feedback
      await fetch("/api/feedback/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment }),
      });
      // Cancel via API
      const res = await fetch("/api/creem/subscription/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[handleCancelSubscription] cancel API error:", res.status, data);
        throw new Error(data.error || "Failed to cancel subscription");
      }
      setShowCancelModal(false);
      setShowCancelSuccessModal(true);
      await fetchSubscriptionStatus();
      await loadAllData();
    } catch (err) {
      console.error("Cancel error:", err);
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setResuming(true);
    try {
      const res = await fetch("/api/creem/subscription/resume", { method: "POST" });
      if (!res.ok) throw new Error("Failed to resume");
      await fetchSubscriptionStatus();
      await loadAllData();
    } catch (err) {
      console.error("Resume error:", err);
      setError("Failed to resume subscription");
    } finally {
      setResuming(false);
    }
  };

  useEffect(() => {
    if (!loadingTier) {
      void fetchSubscriptionStatus();
    }
  }, [loadingTier]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await loadAllData();
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const tierDescription = useMemo(() => {
    if (tier === "STARTER") return "Your account is on the starter plan.";
    if (tier === "PRO") return "Your account is on the pro plan.";
    return "Your account is on the free plan.";
  }, [tier]);

  const planFeatures = useMemo<Record<UserTier, string[]>>(
    () => ({
      FREE: [formatStorageLimitLabel(storageLimits.FREE), ...PLAN_FEATURES_BASE.FREE],
      STARTER: [formatStorageLimitLabel(storageLimits.STARTER), ...PLAN_FEATURES_BASE.STARTER],
      PRO: [formatStorageLimitLabel(storageLimits.PRO), ...PLAN_FEATURES_BASE.PRO],
    }),
    [storageLimits],
  );

  const nextBillingDate = useMemo(() => {
    if (!subscription?.hasSubscription || !subscription?.currentPeriodEnd) return null;
    if (subscription.cancelAtPeriodEnd) return null; // canceling, no next billing
    const date = new Date(subscription.currentPeriodEnd);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }, [subscription]);

  const isCanceling = useMemo(() => {
    return (subscription?.subscriptionStatus === "canceled" || subscription?.cancelAtPeriodEnd) && subscription?.currentPeriodEnd;
  }, [subscription]);

  const planCardBg = (planTier: UserTier, isCurrent: boolean) => {
    if (!isDark) {
      if (isCurrent) {
        if (planTier === "FREE") return "border-slate-500 bg-slate-100/70";
        if (planTier === "STARTER") return "border-indigo-500 bg-indigo-100/60";
        return "border-emerald-600 bg-emerald-100/60";
      }
      if (planTier === "FREE") return "border-slate-300 bg-slate-50/60";
      if (planTier === "STARTER") return "border-indigo-300 bg-indigo-50/50";
      return "border-emerald-400 bg-emerald-50/50";
    } else {
      if (isCurrent) {
        if (planTier === "FREE") return "border-slate-400 bg-slate-700/70";
        if (planTier === "STARTER") return "border-indigo-400 bg-indigo-900/40";
        return "border-emerald-400 bg-emerald-900/40";
      }
      if (planTier === "FREE") return "border-slate-600 bg-slate-800/60";
      if (planTier === "STARTER") return "border-indigo-700 bg-indigo-950/20";
      return "border-emerald-700 bg-emerald-950/20";
    }
  };

  return (
    <div className="relative z-20">
      {/* Stamp */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 stamp border-emerald-500/80 text-emerald-500/80 rounded-lg px-4 sm:px-5 py-2 text-lg sm:text-xl font-black transform -rotate-[10deg] font-mono bg-white/30 backdrop-blur-sm pointer-events-none tracking-widest select-none">
        {loadingTier ? "LOADING" : tier + " TIER"}
      </div>

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        Billing &amp; Plan
      </h2>
      <p className="text-slate-500 font-mono mb-10 text-sm">
        FILE: <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs">billing.ledger</span>
      </p>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-rose-100 border border-rose-300 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm text-rose-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-rose-600 hover:text-rose-800"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-8 max-w-2xl">
        {/* Current Plan Header */}
        <div className="bg-white/60 p-6 rounded-xl border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200 border-dashed">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  {loadingTier ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      Loading plan...
                    </>
                  ) : (
                    TIER_FULL_LABEL[tier]
                  )}
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest font-mono">
                  Current Plan
                </span>
              </div>
              <p className="text-sm text-slate-500">{tierDescription}</p>
            </div>

            {/* Subscription management */}
            <div className="flex flex-col sm:flex-row gap-2 items-center">
              {subscription?.hasSubscription && subscription.subscriptionStatus === "active" && !subscription.cancelAtPeriodEnd && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider border-2 border-rose-400 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
              {(subscription?.subscriptionStatus === "canceled" || subscription?.cancelAtPeriodEnd) && (
                <button
                  onClick={handleResumeSubscription}
                  disabled={resuming}
                  className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider border-2 border-emerald-400 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  {resuming ? "Resuming..." : "Renew Subscription"}
                </button>
              )}
              {!subscription?.hasSubscription && creemCustomerId && (
                <CreemPortalButton customerId={creemCustomerId} />
              )}
            </div>
          </div>

          {/* Subscription details row */}
          {(loadingSubscription || subscription?.hasSubscription || subscription?.subscriptionStatus === "canceled") && (
            <div className="mb-4 space-y-2">
              {loadingSubscription ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking subscription status...
                </div>
              ) : subscription?.hasSubscription ? (
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm">
                  {/* Next billing */}
                  {nextBillingDate && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Next billing: <strong>{nextBillingDate}</strong></span>
                    </div>
                  )}
                  {/* Canceling */}
                  {isCanceling && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>Canceling on {new Date(subscription.currentPeriodEnd!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                  {/* Past due */}
                  {subscription.status === "past_due" && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>Payment past due — please update payment method</span>
                    </div>
                  )}
                </div>
              ) : subscription?.subscriptionStatus === "canceled" && subscription?.currentPeriodEnd ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <Calendar className="w-4 h-4" />
                  <span>Active until: <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></span>
                </div>
              ) : null}
            </div>
          )}

          {/* Plan cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Free */}
            <div className={`p-5 rounded-xl border-2 transition-colors ${planCardBg("FREE", tier === "FREE")}`}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className={`w-5 h-5 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
                <h4 className={`font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>Free</h4>
                {tier === "FREE" && (
                  <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest">
                    Current
                  </span>
                )}
              </div>
              <ul className="space-y-2 mb-5">
                {planFeatures.FREE.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <CheckCircle2 className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-slate-500"} shrink-0`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                disabled
                className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 cursor-not-allowed ${isDark ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-300 text-slate-600 border-slate-400"}`}
              >
                {tier === "FREE" ? "Current Plan" : "Downgrade"}
              </button>
            </div>

            {/* Starter */}
            <div className={`p-5 rounded-xl border-2 transition-colors ${planCardBg("STARTER", tier === "STARTER")}`}>
              <div className="flex items-center gap-2 mb-3">
                <Star className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-500"}`} />
                <h4 className={`font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>Starter</h4>
                {tier === "STARTER" && (
                  <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest">
                    Current
                  </span>
                )}
              </div>
              <ul className="space-y-2 mb-5">
                {planFeatures.STARTER.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <CheckCircle2 className={`w-4 h-4 ${isDark ? "text-indigo-400" : "text-indigo-500"} shrink-0`} />
                    {f}
                  </li>
                ))}
              </ul>
              <CreemCheckoutButton
                productId={STARTER_PRODUCT_ID}
                label={tier === "STARTER" ? "Current Plan" : "Select Starter"}
                isDark={isDark}
                isCurrentPlan={tier === "STARTER"}
                tier="STARTER"
              />
            </div>

            {/* Pro */}
            <div className={`relative p-5 rounded-xl border-2 transition-colors ${planCardBg("PRO", tier === "PRO")}`}>
              <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest rounded font-mono">
                Recommended
              </div>
              <div className="flex items-center gap-2 mb-3 mt-2">
                <Zap className={`w-5 h-5 ${isDark ? "text-emerald-400" : "text-emerald-500"}`} />
                <h4 className={`font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>Pro</h4>
                {tier === "PRO" && (
                  <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest">
                    Current
                  </span>
                )}
              </div>
              <ul className="space-y-2 mb-5">
                {planFeatures.PRO.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <CheckCircle2 className={`w-4 h-4 ${isDark ? "text-emerald-400" : "text-emerald-500"} shrink-0`} />
                    {f}
                  </li>
                ))}
              </ul>
              <CreemCheckoutButton
                productId={PRO_PRODUCT_ID}
                label={tier === "PRO" ? "Current Plan" : "Upgrade to Pro"}
                isDark={isDark}
                isCurrentPlan={tier === "PRO"}
                tier="PRO"
              />
            </div>
          </div>

          {/* Note about Creem */}
          <p className="mt-6 text-xs text-slate-500">
            Payments are securely processed by <a href="https://creem.io" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Creem</a>.
            You can manage or cancel your subscription anytime.
          </p>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <SuccessModal
          tier={pendingTier ?? tier}
          benefits={planFeatures[pendingTier ?? tier]}
          isDark={isDark}
          onClose={() => setShowSuccessModal(false)}
        />
      )}

      {showCancelModal && (
        <CancelSubscriptionModal
          isDark={isDark}
          isLoading={canceling}
          onConfirm={handleCancelSubscription}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showCancelSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCancelSuccessModal(false)} />
          <div className={`relative rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center ${isDark ? "bg-slate-800" : "bg-white"}`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-amber-900/50" : "bg-amber-100"}`}>
              <Calendar className={`w-7 h-7 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
            </div>
            <h3 className={`text-xl font-extrabold mb-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
              Subscription Canceled
            </h3>
            <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Your subscription has been canceled. You can reactivate it anytime before the period ends if you change your mind.
            </p>
            <button
              onClick={() => setShowCancelSuccessModal(false)}
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessModal({ tier, benefits, isDark, onClose }: { tier: UserTier; benefits: string[]; isDark: boolean; onClose: () => void }) {

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative rounded-2xl shadow-2xl max-w-md w-full p-8 text-center transform animate-in fade-in zoom-in-95 duration-300 ${isDark ? "bg-slate-800" : "bg-white"}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 transition-colors ${isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-emerald-900/50" : "bg-emerald-100"}`}>
          <Sparkles className={`w-8 h-8 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
        </div>

        {/* Title */}
        <h3 className={`text-2xl font-extrabold mb-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          You&apos;re now a {tier} member!
        </h3>
        <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Thank you for your support. Here&apos;s what you get:
        </p>

        {/* Benefits */}
        <ul className="text-left space-y-2 mb-6">
          {benefits.map((benefit) => (
            <li key={benefit} className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-500"}`} />
              {benefit}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
        >
          Start Exploring
        </button>
      </div>
    </div>
  );
}

const CANCEL_REASONS = [
  { value: "too-expensive", label: "It's too expensive" },
  { value: "missing-features", label: "It's missing features I need" },
  { value: "not-using", label: "I'm not using it enough" },
  { value: "temporary", label: "I only needed it temporarily" },
  { value: "found-free-alternative", label: "I found a free alternative" },
  { value: "switched-service", label: "I switched to another service" },
  { value: "other", label: "Other reason" },
];

function CancelSubscriptionModal({
  isDark,
  isLoading,
  onConfirm,
  onClose,
}: {
  isDark: boolean;
  isLoading: boolean;
  onConfirm: (reason: string, comment: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative rounded-2xl shadow-2xl max-w-md w-full p-8 ${isDark ? "bg-slate-800" : "bg-white"}`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 ${isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"}`}
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className={`text-xl font-extrabold mb-1 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          Why are you canceling?
        </h3>
        <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Your subscription will remain active until the end of the billing period.
        </p>

        <div className="space-y-3 mb-4">
          {CANCEL_REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                reason === r.value
                  ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20"
                  : isDark ? "border-slate-600 bg-slate-700/50 hover:bg-slate-700" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-rose-500"
              />
              <span className={`text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>{r.label}</span>
            </label>
          ))}
        </div>

        {reason && (
          <div className="mb-6">
            <textarea
              placeholder={reason === "other" ? "Please describe your reason…" : "Additional comments (optional)"}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              required={reason === "other"}
              className={`w-full p-3 rounded-lg border text-sm resize-none outline-none ${
                reason === "other" && !comment.trim()
                  ? "border-rose-400"
                  : isDark ? "border-slate-600" : "border-slate-200"
              } ${
                isDark ? "bg-slate-700 text-slate-200 placeholder-slate-500" : "bg-white text-slate-700 placeholder-slate-400"
              }`}
            />
            {reason === "other" && !comment.trim() && (
              <p className="mt-1 text-xs text-rose-400">Please tell us more before canceling.</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm border-2 transition-colors ${
              isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Keep Subscription
          </button>
          <button
            onClick={() => onConfirm(reason, comment)}
            disabled={!reason || isLoading || (reason === "other" && !comment.trim())}
            className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-rose-500 hover:bg-rose-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Canceling..." : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}
