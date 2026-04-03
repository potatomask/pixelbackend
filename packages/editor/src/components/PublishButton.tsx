"use client";

import React, { useState } from "react";

interface PublishButtonProps {
  isPublished: boolean;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  slug?: string;
}

export function PublishButton({ isPublished, onPublish, onUnpublish, slug }: PublishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePublish = async () => {
    setLoading(true);
    try {
      await onPublish();
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);
    try {
      await onUnpublish();
    } finally {
      setLoading(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="p-3 bg-gray-900 text-white space-y-2">
        <p className="text-sm">Publish this world? Visitors will see it at:</p>
        <p className="text-xs text-blue-400 font-mono">/{slug}</p>
        <div className="flex gap-2">
          <button
            onClick={handlePublish}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50"
          >
            {loading ? "Publishing..." : "Confirm"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-900 text-white space-y-2">
      {isPublished ? (
        <>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm">Published</span>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={loading}
            className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
          >
            Republish
          </button>
          <button
            onClick={handleUnpublish}
            disabled={loading}
            className="w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Unpublish
          </button>
        </>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading}
          className="w-full px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm"
        >
          Publish World
        </button>
      )}
    </div>
  );
}
