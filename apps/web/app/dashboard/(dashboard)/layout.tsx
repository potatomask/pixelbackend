"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  User,
  Shield,
  Globe,
  CreditCard,
  BarChart3,
  Folder,
  FolderOpen,
  Image,
  FileText,
  FileVideo,
  Server,
  Map,
  Sun,
  Moon,
  Monitor,
  Copy,
  Check,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import { SidebarStorage } from "./sidebar-storage";

const tabs = [
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/security", label: "Security", icon: Shield },
  { href: "/dashboard/world", label: "World", icon: Globe },
  { href: "/dashboard/files", label: "Files", icon: FolderOpen },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

type DashboardTourStep = {
  key: string;
  href?: string;
  title: string;
  description: string;
  target: "tab" | "editor";
  nextLabel?: string;
};

const DASHBOARD_TOUR_STEPS: DashboardTourStep[] = [
  {
    key: "profile",
    href: "/dashboard/profile",
    title: "Profile",
    description: "This tab is where you update your public profile details like your name, image, bio, and page link.",
    target: "tab",
    nextLabel: "Next",
  },
  {
    key: "files",
    href: "/dashboard/files",
    title: "Files",
    description: "This tab is where you upload and manage the images, videos, and files you want to use in your page or world.",
    target: "tab",
    nextLabel: "Next",
  },
  {
    key: "world",
    href: "/dashboard/world",
    title: "World",
    description: "This tab is where you manage your world setup and jump into editing it when you are ready to build.",
    target: "tab",
    nextLabel: "Next",
  },
  {
    key: "billing",
    href: "/dashboard/billing",
    title: "Billing",
    description: "This tab is where you manage your plan, billing details, and subscription status.",
    target: "tab",
    nextLabel: "Next",
  },
  {
    key: "editor",
    title: "Map Button",
    description: "You can also edit your world using this button. Try clicking it now.",
    target: "editor",
  },
];

type SidebarUpload = {
  name: string;
  url: string;
  size: number;
  createdAt: string;
};

function isImageFile(filename: string) {
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(filename);
}

function isVideoFile(filename: string) {
  return /\.(mp4|webm|ogg|ogv|mov)$/i.test(filename);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [recentUploads, setRecentUploads] = useState<SidebarUpload[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dashboardTourReady, setDashboardTourReady] = useState(false);
  const [dashboardTourCompleted, setDashboardTourCompleted] = useState(true);
  const [dashboardTourStepIndex, setDashboardTourStepIndex] = useState(0);
  const [dashboardTourRect, setDashboardTourRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const editorButtonRef = useRef<HTMLAnchorElement | null>(null);
  const username = (session?.user as any)?.handle || session?.user?.name || "User";
  const userImage = (session?.user as any)?.image as string | null | undefined;
  const shareUrl = `mypixel.page/${username}`;
  const currentDashboardTourStep = dashboardTourCompleted ? null : DASHBOARD_TOUR_STEPS[dashboardTourStepIndex];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check onboarding status
  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.onboarded) {
          router.replace("/onboarding");
        } else {
          setOnboardingChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setOnboardingChecked(true);
      });
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const loadRecentUploads = async () => {
      try {
        const res = await fetch("/api/media/files");
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setRecentUploads(Array.isArray(data?.files) ? data.files.slice(0, 5) : []);
        }
      } catch {
        if (!cancelled) setRecentUploads([]);
      } finally {
        if (!cancelled) setAttachmentsLoading(false);
      }
    };

    void loadRecentUploads();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onboardingChecked) return;

    let cancelled = false;

    fetch("/api/dashboard-tour", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;

        if (data.completed) {
          setDashboardTourCompleted(true);
        } else {
          const initialIndex = DASHBOARD_TOUR_STEPS.findIndex(
            (step) => step.href && pathname.startsWith(step.href),
          );
          setDashboardTourStepIndex(initialIndex >= 0 ? initialIndex : 0);
          setDashboardTourCompleted(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardTourCompleted(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDashboardTourReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onboardingChecked]);

  const updateDashboardTourRect = useCallback(() => {
    if (!currentDashboardTourStep) {
      setDashboardTourRect(null);
      return;
    }

    const element = currentDashboardTourStep.target === "editor"
      ? editorButtonRef.current
      : (currentDashboardTourStep.href ? tabRefs.current[currentDashboardTourStep.href] : null);

    if (!element) {
      setDashboardTourRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setDashboardTourRect(null);
      return;
    }

    setDashboardTourRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [currentDashboardTourStep]);

  useEffect(() => {
    if (!dashboardTourReady || dashboardTourCompleted) return;

    const syncRect = () => {
      requestAnimationFrame(() => updateDashboardTourRect());
    };

    syncRect();
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);

    return () => {
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [dashboardTourReady, dashboardTourCompleted, dashboardTourStepIndex, pathname, updateDashboardTourRect]);

  const completeDashboardTour = useCallback(async () => {
    setDashboardTourCompleted(true);
    setDashboardTourRect(null);

    try {
      await fetch("/api/dashboard-tour", {
        method: "PATCH",
        keepalive: true,
      });
    } catch {
      // Ignore persistence failures so the UI doesn't get stuck.
    }
  }, []);

  const advanceDashboardTour = useCallback(() => {
    if (dashboardTourCompleted) return;

    const nextIndex = dashboardTourStepIndex + 1;
    if (nextIndex >= DASHBOARD_TOUR_STEPS.length) {
      void completeDashboardTour();
      return;
    }

    const nextStep = DASHBOARD_TOUR_STEPS[nextIndex];
    if (!nextStep) {
      void completeDashboardTour();
      return;
    }

    setDashboardTourStepIndex(nextIndex);

    if (nextStep.href && pathname !== nextStep.href) {
      router.push(nextStep.href);
    }
  }, [completeDashboardTour, dashboardTourCompleted, dashboardTourStepIndex, pathname, router]);

  if (!onboardingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const spotlightRect = dashboardTourRect
    ? {
        top: Math.max(8, dashboardTourRect.top - 10),
        left: Math.max(8, dashboardTourRect.left - 10),
        width: dashboardTourRect.width + 20,
        height: dashboardTourRect.height + 20,
      }
    : null;

  let dashboardTourCardStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(360px, calc(100vw - 2rem))",
  };

  if (spotlightRect && typeof window !== "undefined") {
    const cardWidth = Math.min(360, window.innerWidth - 32);
    const estimatedCardHeight = 230;
    const belowTop = spotlightRect.top + spotlightRect.height + 16;
    const top = belowTop + estimatedCardHeight <= window.innerHeight - 16
      ? belowTop
      : Math.max(16, spotlightRect.top - estimatedCardHeight - 16);
    const left = Math.min(
      Math.max(16, spotlightRect.left),
      Math.max(16, window.innerWidth - cardWidth - 16),
    );

    dashboardTourCardStyle = {
      top,
      left,
      width: cardWidth,
    };
  }

  return (
    <div className="dashboard-bg min-h-screen py-6 px-4 sm:py-12 sm:px-12 flex flex-col items-center font-sans text-slate-900">
      <div className="max-w-6xl w-full flex-1 flex flex-col">
        {/* ── Header ── */}
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div className="flex-1 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white/50 p-6 rounded-2xl border-2 border-slate-300 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500 rounded-xl border-2 border-slate-800 shadow-[4px_4px_0_#334155]">
                <Folder className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">
                  System Explorer
                </h1>
                <p className="text-slate-500 font-medium mt-1 font-mono flex items-center gap-2 text-xs sm:text-sm">
                  <Server className="w-4 h-4" />
                  DIRECTORY: /home/{username}/dashboard
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg font-bold border-2 border-slate-800 btn-action hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
                title="Toggle theme"
              >
                {!mounted ? (
                  <Monitor className="w-4 h-4" />
                ) : theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={async () => {
                  await signOut();
                  window.location.href = "/";
                }}
                className="bg-rose-400 text-white px-5 py-2 rounded-lg font-bold border-2 border-slate-800 btn-action hover:bg-rose-300 text-sm"
              >
                Log Out
              </button>
            </div>
          </div>
          {/* Editor shortcut */}
          <Link
            href="/dashboard/editor"
            ref={editorButtonRef}
            onClick={() => {
              if (!dashboardTourCompleted && currentDashboardTourStep?.target === "editor") {
                void completeDashboardTour();
              }
            }}
            className="hidden sm:flex w-[72px] h-[72px] bg-emerald-500 hover:bg-emerald-400 rounded-2xl border-2 border-slate-800 shadow-[4px_4px_0_#334155] items-center justify-center transition-colors shrink-0"
            title="Open Editor"
          >
            <Map className="w-8 h-8 text-white" />
          </Link>
        </header>

        {/* ── Folder Tabs (Desktop) ── */}
        <div className="hidden md:flex px-4 items-end z-10 relative">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                ref={(element) => {
                  tabRefs.current[tab.href] = element;
                }}
                className={`folder-tab flex items-center gap-2.5 px-6 lg:px-8 py-3 cursor-pointer group ${
                  isActive ? "folder-tab-active" : "folder-tab-inactive"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive
                      ? "text-slate-700"
                      : "text-slate-500 group-hover:text-indigo-600 transition-colors"
                  }`}
                />
                <span
                  className={`font-bold font-mono uppercase tracking-wider text-xs lg:text-sm ${
                    isActive
                      ? "text-slate-800"
                      : "text-slate-500 group-hover:text-indigo-600 transition-colors"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Folder Body ── */}
        <main className="folder-body p-6 sm:p-8 lg:p-10 flex-1 relative z-20 flex flex-col md:flex-row gap-6 lg:gap-8">
          {/* Left sidebar */}
          <aside className="w-full md:w-56 lg:w-64 shrink-0 flex flex-col gap-6 font-mono">
            {/* Player snapshot */}
            <div className="bg-amber-100/50 p-5 rounded-xl border-2 border-amber-500/30">
              <h3 className="font-bold border-b-2 border-amber-500/30 pb-2 mb-4 text-[10px] tracking-widest text-amber-700 uppercase">
                USER_INFO.DAT
              </h3>
              <div className="flex flex-col items-center gap-3 mb-1">
                {/* Profile picture */}
                {userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userImage}
                    alt={username}
                    className="w-14 h-14 rounded-xl border-2 border-indigo-400 object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 bg-indigo-200 border-2 border-indigo-400 rounded-xl shadow-sm flex items-center justify-center text-indigo-500 font-black text-2xl">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-800 uppercase">{username}</p>
                  <p className="text-[10px] text-slate-500">{session?.user?.email || "loading..."}</p>
                </div>
                {/* Shareable link */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://${shareUrl}`).catch(() => {});
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="w-full flex items-center justify-between gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2 py-1.5 transition-colors group"
                  title="Copy your page link"
                >
                  <span className="text-[10px] text-indigo-600 font-mono truncate">{shareUrl}</span>
                  {linkCopied ? (
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 text-indigo-400 shrink-0 group-hover:text-indigo-600 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-amber-100/50 p-5 rounded-xl border-2 border-amber-500/30 flex-1">
              <h3 className="font-bold border-b-2 border-amber-500/30 pb-2 mb-4 text-[10px] tracking-widest text-amber-700 uppercase">
                ATTACHMENTS
              </h3>
              <ul className="space-y-3 text-sm text-slate-700">
                {attachmentsLoading && (
                  <li className="text-xs text-slate-500 p-2">Loading uploads...</li>
                )}
                {!attachmentsLoading && recentUploads.length === 0 && (
                  <li className="text-xs text-slate-500 p-2">No attachments yet.</li>
                )}
                {!attachmentsLoading && recentUploads.map((file) => (
                  <li key={file.name} className="flex items-center gap-3 hover:bg-white/50 p-2 -mx-2 rounded transition-colors group">
                    {isImageFile(file.name) ? (
                      <Image className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                    ) : isVideoFile(file.name) ? (
                      <FileVideo className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
                    ) : (
                      <FileText className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                    )}
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs truncate hover:underline"
                      title={file.name}
                    >
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Storage info */}
            <SidebarStorage />

            {/* Mobile nav links */}
            <nav className="md:hidden bg-amber-100/50 p-4 rounded-xl border-2 border-amber-500/30">
              <h3 className="font-bold border-b-2 border-amber-500/30 pb-2 mb-3 text-[10px] tracking-widest text-amber-700 uppercase">
                NAVIGATION
              </h3>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname.startsWith(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                        isActive
                          ? "bg-white border-slate-800 text-slate-800 shadow-[2px_2px_0_#334155]"
                          : "border-amber-400/50 text-amber-800 hover:bg-white/50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </aside>

          {/* Main paper content */}
          <section className="flex-1 paper-sheet p-6 sm:p-8 lg:p-12 relative rounded-lg border-b-8 border-r-8 border-slate-300">
            {/* Paper clip */}
            <div className="hidden sm:block absolute -top-6 right-16 w-8 h-16 border-4 border-slate-400 rounded-full shadow-md transform rotate-12 z-30" />
            <div className="hidden sm:block absolute -top-4 right-14 w-8 h-12 border-4 border-slate-300 rounded-full transform rotate-12 z-10 border-t-0 border-l-0" />
            {children}
          </section>
        </main>
      </div>

      {dashboardTourReady && !dashboardTourCompleted && currentDashboardTourStep && (
        <>
          <div className="pointer-events-none fixed inset-0 z-[80]">
            {spotlightRect ? (
              <div
                className="absolute rounded-2xl border-4 border-emerald-400 bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.58)] transition-all duration-200 dark:shadow-[0_0_0_9999px_rgba(0,0,0,0.75)]"
                style={spotlightRect}
              />
            ) : (
              <div className="absolute inset-0 bg-slate-950/55 dark:bg-black/65" />
            )}
          </div>

          <div
            className="pointer-events-auto fixed z-[81] rounded-2xl border-2 border-slate-800 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.28)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
            style={dashboardTourCardStyle}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-3 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              Dashboard Tour {dashboardTourStepIndex + 1}/{DASHBOARD_TOUR_STEPS.length}
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{currentDashboardTourStep.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{currentDashboardTourStep.description}</p>

            {currentDashboardTourStep.target === "editor" ? (
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  Click the highlighted button to finish
                </p>
                <button
                  type="button"
                  onClick={() => void completeDashboardTour()}
                  className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Skip Tour
                </button>
              </div>
            ) : (
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void completeDashboardTour()}
                  className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Skip Tour
                </button>
                <button
                  type="button"
                  onClick={advanceDashboardTour}
                  className="rounded-xl border-2 border-slate-800 bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-400 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {currentDashboardTourStep.nextLabel ?? "Next"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
