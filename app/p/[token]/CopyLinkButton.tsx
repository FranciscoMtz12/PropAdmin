"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export default function CopyLinkButton({ url, label = "Compartir" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "var(--border-radius-md)",
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        color: copied ? "#10B981" : "#334155",
        cursor: "pointer",
        transition: "color 0.2s",
        flexShrink: 0,
      }}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {copied ? "Copiado" : label}
    </button>
  );
}
