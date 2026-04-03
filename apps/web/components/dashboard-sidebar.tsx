"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Shield,
  Map as MapIcon,
  CreditCard,
  BarChart3,
  LogOut,
  Home,
  Monitor,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const links = [
    { href: "/dashboard/profile", label: "Profile", icon: User },
    { href: "/dashboard/security", label: "Security", icon: Shield },
    { href: "/dashboard/world", label: "World", icon: MapIcon },
    { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="w-64 h-full border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex-col transition-colors duration-300 hidden md:flex">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-gray-100 uppercase tracking-wider">MyPixelPage</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-500 dark:text-emerald-400" : ""}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="mb-4 px-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 select-none">Theme</span>
            {mounted && (
              <div className="flex bg-gray-200 dark:bg-gray-800 rounded-full p-1 border border-gray-300 dark:border-gray-700">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-1.5 rounded-full transition-colors ${theme === "light" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                  title="Light"
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`p-1.5 rounded-full transition-colors ${theme === "system" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                  title="System"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`p-1.5 rounded-full transition-colors ${theme === "dark" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
                  title="Dark"
                >
                  <Moon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={async () => {
              await signOut();
              window.location.href = "/";
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex justify-around p-2 pb-6">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                isActive ? "text-emerald-500 dark:text-emerald-400" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
