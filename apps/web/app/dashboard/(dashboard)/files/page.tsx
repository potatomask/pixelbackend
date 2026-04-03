"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, FileImage, FileVideo, AlertCircle, Loader2, HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/storage";
import { useNotify } from "@/components/notifications";

interface UserFile {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

interface StorageInfo {
  used: number;
  limit: number;
  tier: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm } = useNotify();

  const load = async () => {
    try {
      const res = await fetch("/api/media/files");
      const data = await res.json();
      setFiles(data.files || []);
      setStorage(data.storage || null);
    } catch {
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      await load();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = (filename: string) => {
    confirm(`Delete ${filename}?`, async () => {
      try {
        const res = await fetch("/api/media/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename }),
        });
        if (!res.ok) throw new Error("Delete failed");
        await load();
      } catch {
        setError("Failed to delete file");
      }
    }, { title: "Delete file", confirmText: "Delete", cancelText: "Cancel" });
  };

  const isImage = (name: string) => /\.(png|jpe?g|gif|webp|avif)$/i.test(name);

  const pct = storage ? Math.min((storage.used / storage.limit) * 100, 100) : 0;
  const barColor = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="relative z-20">
      {/* Stamp */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 stamp border-indigo-500/80 text-indigo-500/80 rounded-lg px-4 sm:px-5 py-2 text-lg sm:text-xl font-black transform rotate-[8deg] font-mono bg-white/30 backdrop-blur-sm pointer-events-none tracking-widest select-none">
        FILES
      </div>

      <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-800 mb-2 mt-4">
        File Manager
      </h2>
      <p className="text-slate-500 font-mono mb-8 text-sm">
        DIR: <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">~/uploads/</span>
      </p>

      <div className="space-y-6 max-w-2xl">
        {/* Storage bar */}
        {storage && (
          <div className="bg-white/60 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-slate-600" />
                <span className="font-bold text-sm text-slate-800">Storage</span>
              </div>
              <span className="text-xs font-mono text-slate-500 uppercase">{storage.tier} plan</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 font-mono">
              {formatBytes(storage.used)} / {formatBytes(storage.limit)} used
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
          </div>
        )}

        {/* Upload button */}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl border-2 border-slate-800 btn-action uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload File"}
          </button>
        </div>

        {/* File list */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 font-mono text-sm animate-pulse py-8">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="bg-white/60 p-8 rounded-xl border border-slate-200 text-center">
            <FileImage className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No files uploaded yet.</p>
            <p className="text-slate-400 text-xs mt-1">Upload images or videos to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.name}
                className="bg-white/60 p-3 rounded-xl border border-slate-200 flex items-center gap-3 hover:bg-white/80 transition-colors group"
              >
                {/* Thumbnail */}
                {isImage(file.name) ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <FileVideo className="w-5 h-5 text-slate-400" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {formatBytes(file.size)} &middot; {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(file.name)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="Delete file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
