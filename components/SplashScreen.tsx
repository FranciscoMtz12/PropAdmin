"use client";

import { useEffect, useState } from "react";

/*
  SplashScreen — splash de bienvenida después del login.

  Se dispara leyendo el flag `show_splash` en sessionStorage (seteado
  por app/login/page.tsx tras un signInWithPassword exitoso). Al
  montar, si el flag === "1" se muestra por 2500ms con la animación
  `sapSplash` del logo, luego se oculta y limpia el flag para que la
  siguiente navegación no lo dispare.
*/

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("show_splash") !== "1") return;

    sessionStorage.removeItem("show_splash");
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(160deg, #0d1b2a 0%, #1c3a5e 60%, #0d1b2a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
    }}>
      <img
        src="/brands/saproa/saproa-stacked-dark.png"
        alt="SAPROA"
        className="splash-logo"
        style={{ width: 160, height: 160, objectFit: "contain" }}
      />
    </div>
  );
}
