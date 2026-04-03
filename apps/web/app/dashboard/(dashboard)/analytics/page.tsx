import { BarChart3, Clock, MousePointerClick, Users } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="relative z-20">
      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        Analytics
      </h2>
      <p className="text-slate-500 font-mono mb-10 text-sm">
        FILE: <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">analytics.log</span>
      </p>

      <div className="relative max-w-2xl">
        {/* Coming soon overlay */}
        <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-8">
          <div className="bg-white border-2 border-slate-300 shadow-lg rounded-xl p-8 max-w-sm text-center">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-5 border-2 border-blue-200">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-800 mb-3">Coming Soon</h3>
            <p className="text-slate-500 text-sm mb-6">
              We&apos;re building a powerful analytics engine to help you understand how users interact with your pixel world.
            </p>
            <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider border-2 border-slate-800 btn-action hover:bg-indigo-500">
              Notify Me
            </button>
          </div>
        </div>

        {/* Blurred dummy content */}
        <div className="opacity-40 select-none space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: "Visitors", value: "8,492", change: "+12%" },
              { icon: MousePointerClick, label: "Clicks", value: "45.2k", change: "+24%" },
              { icon: Clock, label: "Avg Time", value: "4m 12s", change: "-2%" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white/60 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-slate-500">
                    <Icon className="w-4 h-4" />
                    <span className="font-mono text-[10px] uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <span className="text-xl font-black text-slate-800">{stat.value}</span>
                  <span className="text-xs font-bold text-emerald-500 ml-2">{stat.change}</span>
                </div>
              );
            })}
          </div>

          <div className="bg-white/60 border border-slate-200 rounded-xl p-6 h-48 flex items-end justify-between px-8 py-6">
            {[40, 70, 45, 90, 65, 85, 100].map((h, i) => (
              <div
                key={i}
                className="w-8 bg-blue-200 rounded-t-md"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
