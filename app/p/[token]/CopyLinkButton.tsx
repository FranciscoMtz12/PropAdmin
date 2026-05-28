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
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--border-radius-md)",
        padding: "8px 14px",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: copied ? "var(--metric-value-green)" : "var(--text-primary)",
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
