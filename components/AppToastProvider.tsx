"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

/*
  Sistema global de toast para PropAdmin.

  Objetivo:
  - mostrar mensajes flotantes de éxito / error / warning / info
  - evitar que el layout "brinque" cuando aparezcan mensajes
  - reutilizar la misma UX en todas las páginas del sistema

  Regla visual:
  - los mensajes ya no deben empujar el contenido de la página
  - viven fijos en pantalla
  - se cierran solos después de unos segundos
  - también se pueden cerrar manualmente
*/

type ToastType = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
};

type ShowToastInput = {
  type?: ToastType;
  message: string;
  duration?: number;
};

type AppToastContextType = {
  showToast: (input: ShowToastInput) => void;
  hideToast: (id: string) => void;
  clearToasts: () => void;
};

const AppToastContext = createContext<AppToastContextType | undefined>(undefined);

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const hideToast = useCallback((id: string) => {
    const timeout = timeoutMapRef.current.get(id);

    if (timeout) {
      clearTimeout(timeout);
      timeoutMapRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    timeoutMapRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutMapRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({ type = "success", message, duration = 3200 }: ShowToastInput) => {
      if (!message.trim()) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const nextToast: ToastItem = {
        id,
        type,
        message: message.trim(),
        duration,
      };

      setToasts((prev) => [...prev, nextToast]);

      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        timeoutMapRef.current.delete(id);
      }, duration);

      timeoutMapRef.current.set(id, timeout);
    },
    []
  );

  useEffect(() => {
    return () => {
      timeoutMapRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutMapRef.current.clear();
    };
  }, []);

  const value = useMemo<AppToastContextType>(
    () => ({
      showToast,
      hideToast,
      clearToasts,
    }),
    [showToast, hideToast, clearToasts]
  );

  return (
    <AppToastContext.Provider value={value}>
      {children}

      {/* Contenedor fijo global de toasts. No participa en el layout normal. */}
      <div style={toastViewportStyle} aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const visual = getToastVisual(toast.type);

          return (
            <div
              key={toast.id}
              role="status"
              style={{
                ...toastCardStyle,
                background: visual.background,
                border: `1px solid ${visual.border}`,
                color: visual.text,
              }}
            >
              <div style={toastContentRowStyle}>
                <div
                  style={{
                    ...toastIconBoxStyle,
                    background: visual.iconBackground,
                    color: visual.iconColor,
                  }}
                >
                  {visual.icon}
                </div>

                <div style={toastMessageWrapStyle}>
                  <div style={toastTitleStyle}>{visual.label}</div>
                  <div style={toastMessageStyle}>{toast.message}</div>
                </div>

                <button
                  type="button"
                  onClick={() => hideToast(toast.id)}
                  aria-label="Cerrar notificación"
                  title="Cerrar"
                  style={closeButtonStyle}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppToastContext.Provider>
  );
}

export function useAppToast() {
  const context = useContext(AppToastContext);

  if (!context) {
    throw new Error("useAppToast debe usarse dentro de AppToastProvider.");
  }

  return context;
}

function getToastVisual(type: ToastType) {
  if (type === "success") {
    return {
      label: "Correcto",
      background: "#ECFDF5",
      border: "#A7F3D0",
      text: "#166534",
      iconBackground: "#DCFCE7",
      iconColor: "#15803D",
      icon: <CheckCircle2 size={18} />,
    };
  }

  if (type === "error") {
    return {
      label: "Error",
      background: "#FEF2F2",
      border: "#FECACA",
      text: "#B91C1C",
      iconBackground: "#FEE2E2",
      iconColor: "#DC2626",
      icon: <AlertCircle size={18} />,
    };
  }

  if (type === "warning") {
    return {
      label: "Atención",
      background: "#FFFBEB",
      border: "#FDE68A",
      text: "#A16207",
      iconBackground: "#FEF3C7",
      iconColor: "#D97706",
      icon: <AlertTriangle size={18} />,
    };
  }

  return {
    label: "Información",
    background: "#EFF6FF",
    border: "#BFDBFE",
    text: "#1D4ED8",
    iconBackground: "#DBEAFE",
    iconColor: "#2563EB",
    icon: <Info size={18} />,
  };
}

const toastViewportStyle: React.CSSProperties = {
  position: "fixed",
  top: 20,
  right: 20,
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "min(380px, calc(100vw - 32px))",
  pointerEvents: "none",
};

const toastCardStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
  padding: 14,
  pointerEvents: "auto",
  backdropFilter: "blur(8px)",
};

const toastContentRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "start",
  gap: 12,
};

const toastIconBoxStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const toastMessageWrapStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  paddingTop: 1,
};

const toastTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.2,
};

const toastMessageStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 600,
  wordBreak: "break-word",
};

const closeButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  border: "1px solid rgba(0, 0, 0, 0.08)",
  background: "rgba(255, 255, 255, 0.72)",
  color: "#374151",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};