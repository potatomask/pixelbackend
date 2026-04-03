import Link from "next/link";
import { Map, Palette, Globe, Play } from "lucide-react";

export default function WorldPage() {
  return (
    <div className="relative z-20">
      {/* Stamp */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 stamp border-emerald-500/80 text-emerald-500/80 rounded-lg px-4 sm:px-6 py-2 text-xl sm:text-2xl font-black transform rotate-[12deg] font-mono bg-white/30 backdrop-blur-sm pointer-events-none tracking-widest select-none">
        ONLINE
      </div>

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        World Settings
      </h2>
      <p className="text-slate-500 font-mono mb-10 text-sm">
        FILE: <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs">world.config</span>
      </p>

      <div className="space-y-8 max-w-2xl">
        {/* Editor Launch */}
        <div className="bg-white/60 p-6 rounded-xl border-2 border-indigo-200 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4 font-mono">
              <Globe className="w-3.5 h-3.5" />
              Status: Active
            </div>
            <h3 className="text-2xl font-extrabold text-slate-800 mb-2">
              Your Universe is waiting
            </h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Step into the editor to paint tiles, place objects, setup logic, and bring your digital space to life. All changes are saved automatically.
            </p>
            <Link
              href="/dashboard/editor"
              className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl border-2 border-slate-800 btn-action uppercase tracking-wider text-sm transition-colors"
            >
              <Play className="w-5 h-5 fill-current" />
              Enter Editor
            </Link>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white/60 p-5 rounded-xl border border-slate-200 hover:bg-white/80 transition-colors cursor-pointer group">
            <Palette className="w-7 h-7 text-pink-500 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-bold text-slate-800 mb-1">Assets &amp; Themes</h4>
            <p className="text-xs text-slate-500 mb-3">
              Custom color palettes and uploaded sprites.
            </p>
            <span className="text-xs font-bold text-pink-500 font-mono uppercase tracking-wider">
              Open manager →
            </span>
          </div>

          <div className="bg-white/60 p-5 rounded-xl border border-slate-200 hover:bg-white/80 transition-colors cursor-pointer group">
            <Map className="w-7 h-7 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-bold text-slate-800 mb-1">Publishing</h4>
            <p className="text-xs text-slate-500 mb-3">
              Domain, links, and visibility settings.
            </p>
            <span className="text-xs font-bold text-emerald-500 font-mono uppercase tracking-wider">
              Manage domains →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
