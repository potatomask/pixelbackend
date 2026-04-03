"use client";

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/storage";

export function SidebarStorage() {
  const [data, setData] = useState<{ used: number; limit: number; tier: string } | null>(null);

  useEffect(() => {
    fetch("/api/media/storage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const pct = Math.min((data.used / data.limit) * 100, 100);
  const barColor =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="bg-amber-100/50 p-4 rounded-xl border-2 border-amber-500/30">
      <h3 className="font-bold border-b-2 border-amber-500/30 pb-2 mb-3 text-[10px] tracking-widest text-amber-700 uppercase flex items-center gap-2">
        <HardDrive className="w-3 h-3" />
        STORAGE.SYS
      </h3>
      <div className="space-y-2">
        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>{formatBytes(data.used)} used</span>
          <span>{formatBytes(data.limit)}</span>
        </div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider">
          {data.tier} plan
        </p>
      </div>
    </div>
  );
}
