import { ProfileForm } from "@/components/profile-form";

export default function ProfilePage() {
  return (
    <div className="relative z-20">
      {/* Stamp */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 stamp border-red-500/80 text-red-500/80 rounded-lg px-4 sm:px-6 py-2 text-xl sm:text-3xl font-black transform rotate-[15deg] font-mono bg-white/30 backdrop-blur-sm pointer-events-none tracking-widest select-none">
        VERIFIED
      </div>

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        Personal Details
      </h2>
      <p className="text-slate-500 font-mono mb-10 text-sm">
        Last updated:{" "}
        <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
          {new Date().toISOString().split("T")[0]}
        </span>
      </p>

      <div className="max-w-2xl">
        <ProfileForm />
      </div>
    </div>
  );
}
