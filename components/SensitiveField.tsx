"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export type SensitiveFieldType = "rfc" | "phone" | "email" | "bank" | "generic"

interface SensitiveFieldProps {
  value: string | null | undefined
  type?: SensitiveFieldType
  className?: string
}

function mask(value: string, type: SensitiveFieldType): string {
  if (!value) return value
  switch (type) {
    case "rfc": {
      if (value.length <= 6) return value
      return value.slice(0, 3) + "*".repeat(value.length - 6) + value.slice(-3)
    }
    case "phone": {
      if (value.length <= 7) return value
      return value.slice(0, 3) + "***" + value.slice(-4)
    }
    case "email": {
      const atIdx = value.indexOf("@")
      if (atIdx <= 0) return value
      const local = value.slice(0, atIdx)
      const domain = value.slice(atIdx)
      const visible = Math.min(3, local.length)
      return local.slice(0, visible) + "***" + domain
    }
    case "bank": {
      if (value.length <= 4) return value
      return "****" + value.slice(-4)
    }
    case "generic":
    default: {
      if (value.length <= 4) return value
      return value.slice(0, 2) + "***" + value.slice(-2)
    }
  }
}

export default function SensitiveField({ value, type = "generic", className }: SensitiveFieldProps) {
  const [revealed, setRevealed] = useState(false)

  if (!value) return <span style={{ color: "var(--text-muted)" }}>—</span>

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <span
        style={{
          fontFamily: type === "rfc" || type === "bank" ? "monospace" : undefined,
          opacity: 1,
          transition: "opacity 200ms",
        }}
      >
        {revealed ? value : mask(value, type)}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        title={revealed ? "Ocultar" : "Revelar"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          minWidth: 28,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          padding: "0 2px",
          flexShrink: 0,
          opacity: 0.7,
          transition: "opacity 200ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
      >
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  )
}
