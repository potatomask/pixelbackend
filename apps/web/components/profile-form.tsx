"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { Check, Loader2, AlertCircle, Save, Upload, X, Copy, Link, Info } from "lucide-react";
import { uploadMediaFile } from "../lib/uploadMedia";
import { useNotify } from "./notifications";

export function ProfileForm() {
  const { data: session, isPending } = useSession();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [checkingInfo, setCheckingInfo] = useState({ state: "idle", message: "" });
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { toast } = useNotify();

  useEffect(() => {
    if (session?.user) {
      setHandle((session.user as any).handle || "");
      setDisplayName((session.user as any).displayName || "");
      setBio((session.user as any).bio || "");
      setImage((session.user as any).image || "");
    }
  }, [session]);

  if (isPending) {
    return (
      <div className="flex animate-pulse gap-2 items-center text-slate-500 font-mono text-sm">
        Loading user info...
      </div>
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB for profile picture)
    if (file.size > 5 * 1024 * 1024) {
      toast("error", "Image must be smaller than 5MB");
      return;
    }

    setImageUploading(true);
    try {
      const result = await uploadMediaFile(file);
      setImage(result.url);
    } catch (err) {
      toast("error", "Failed to upload image: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const checkUsername = async (val: string) => {
    if (!val || val === (session?.user as any)?.handle) {
      setCheckingInfo({ state: "idle", message: "" });
      return;
    }
    if (val.length < 3) {
      setCheckingInfo({ state: "taken", message: "Username must be at least 3 characters." });
      return;
    }
    setCheckingInfo({ state: "checking", message: "Checking availability..." });
    try {
      const res = await fetch(`/api/users/check-handle?handle=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.available) {
        setCheckingInfo({ state: "available", message: "Username is available!" });
      } else if (data.reason === "too_short") {
        setCheckingInfo({ state: "taken", message: "Username must be at least 3 characters." });
      } else if (data.reason === "reserved") {
        setCheckingInfo({ state: "taken", message: "This username is reserved." });
      } else {
        setCheckingInfo({ state: "taken", message: "Username is already taken." });
      }
    } catch {
      setCheckingInfo({ state: "error", message: "Error checking username." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkingInfo.state === "taken") return;
    
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, displayName, bio, image }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save");
      }
      toast("success", "Profile saved successfully");
      setCheckingInfo({ state: "idle", message: "" });
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 font-mono text-sm text-blue-800 rounded shadow-sm flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
        <span>
          <span className="font-bold uppercase">Note:</span>{" "}
          Changing your Username will immediately update your public profile URL.
        </span>
      </div>

      {/* Username */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200">
        <label className="block text-slate-500 font-black mb-1 font-mono uppercase tracking-wider text-xs flex justify-between">
          Username
          {checkingInfo.state === "available" && (
            <span className="text-emerald-600 bg-emerald-100 px-2 rounded font-bold normal-case flex items-center gap-1">
              <Check className="w-3 h-3" /> Available
            </span>
          )}
          {checkingInfo.state === "taken" && (
            <span className="text-red-600 bg-red-100 px-2 rounded font-bold normal-case flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Taken
            </span>
          )}
        </label>
        <div className="relative flex items-center">
          <span className="text-slate-400 font-mono text-xl mr-2">@</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              const timer = setTimeout(() => checkUsername(e.target.value), 500);
              return () => clearTimeout(timer);
            }}
            className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-2xl text-slate-800 font-bold font-mono transition-colors"
            placeholder="your_handle"
          />
          <div className="absolute right-0 top-3">
            {checkingInfo.state === "checking" && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
          </div>
        </div>
        {checkingInfo.message && (
          <p className={`text-xs mt-1.5 font-mono ${
            checkingInfo.state === "available" ? "text-emerald-500" : checkingInfo.state === "taken" ? "text-red-500" : "text-slate-500"
          }`}>
            {checkingInfo.message}
          </p>
        )}
        {/* Shareable link */}
        {handle && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`https://mypixel.page/${handle}`).catch(() => {});
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            className="mt-3 flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors group w-full"
            title="Copy shareable link"
          >
            <Link className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-xs text-indigo-600 font-mono flex-1 text-left truncate">
              mypixel.page/{handle}
            </span>
            {linkCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:text-indigo-600 transition-colors" />
            )}
          </button>
        )}
      </div>

      {/* Display Name */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200">
        <label className="block text-slate-500 font-black mb-1 font-mono uppercase tracking-wider text-xs">
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 py-2 outline-none text-2xl text-slate-800 transition-colors"
          placeholder="Creative Name"
        />
      </div>

      {/* Profile Picture */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200">
        <label className="block text-slate-500 font-black mb-3 font-mono uppercase tracking-wider text-xs">
          Profile Picture
        </label>
        <div className="flex items-center gap-4">
          {image && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt="Profile"
                className="w-16 h-16 rounded-lg object-cover border-2 border-slate-300"
              />
              <button
                type="button"
                onClick={() => setImage("")}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={imageUploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {imageUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Image
                </>
              )}
            </button>
            <p className="text-xs text-slate-500 mt-1">Max 5MB. PNG, JPEG, WebP, GIF accepted.</p>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="bg-white/60 p-5 rounded-xl border border-slate-200">
        <label className="block text-slate-500 font-black mb-3 font-mono uppercase tracking-wider text-xs">
          Biography
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full bg-slate-50/50 border-2 border-slate-200 focus:border-indigo-500 rounded-lg p-4 outline-none text-lg text-slate-800 resize-none leading-relaxed transition-colors shadow-inner"
          placeholder="Tell us about yourself..."
        />
      </div>

      <div className="pt-4 border-t border-slate-300 border-dashed flex justify-end">
        <button
          type="submit"
          disabled={saving || checkingInfo.state === "taken"}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black tracking-widest uppercase border-2 border-slate-800 btn-action text-base inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? "Saving..." : "Update Record"}
        </button>
      </div>
    </form>
  );
}
