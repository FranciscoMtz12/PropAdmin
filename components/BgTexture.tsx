"use client";

/*
  BgTexture — patrón SVG de íconos de edificios/elementos inmobiliarios que
  se aplica como fondo decorativo a toda la app. El color del trazo y la
  opacidad se ajustan según el modo oscuro/claro del ThemeContext.

  Se renderiza con position: fixed y z-index: 0. El contenido principal
  (Sidebar, main) debe quedar por encima (position: relative + z-index ≥ 1).
*/

import { useTheme } from "@/contexts/ThemeContext";

export default function BgTexture() {
  const { isDark } = useTheme();
  const stroke = isDark ? "#ffffff" : "#1a1a2e";
  const opacity = isDark ? 0.04 : 0.05;

  const icons = `
    <rect x="0" y="0" width="16" height="22"/><rect x="2" y="3" width="4" height="4"/><rect x="10" y="3" width="4" height="4"/><rect x="2" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="5" y="16" width="6" height="6"/>
    <circle cx="56" cy="6" r="5"/><line x1="61" y1="6" x2="72" y2="6"/><line x1="69" y1="6" x2="69" y2="10"/><line x1="65" y1="6" x2="65" y2="9"/>
    <rect x="110" y="0" width="12" height="28"/><rect x="112" y="3" width="3" height="4"/><rect x="117" y="3" width="3" height="4"/><rect x="112" y="10" width="3" height="4"/><rect x="117" y="10" width="3" height="4"/><rect x="112" y="17" width="3" height="4"/><rect x="117" y="17" width="3" height="4"/><rect x="113" y="23" width="6" height="5"/>
    <rect x="160" y="2" width="14" height="20"/><path d="M167 22 Q174 11 167 2"/><circle cx="171" cy="11" r="1.2"/>
    <rect x="210" y="0" width="16" height="13"/><line x1="218" y1="0" x2="218" y2="13"/><line x1="210" y1="6" x2="226" y2="6"/>
    <path d="M267 2 a7 7 0 0 1 14 0 c0 7-7 16-7 16 s-7-9-7-16z"/><circle cx="274" cy="2" r="3.5"/>
    <rect x="320" y="7" width="16" height="12" rx="2"/><path d="M323 7 v-3 a5 5 0 0 1 10 0 v3"/><circle cx="328" cy="13" r="1.8"/>
    <rect x="370" y="0" width="20" height="26"/><line x1="373" y1="6" x2="387" y2="6"/><line x1="373" y1="11" x2="387" y2="11"/><line x1="373" y1="16" x2="382" y2="16"/><rect x="373" y="20" width="7" height="4"/>

    <rect x="0" y="44" width="26" height="16" rx="2"/><path d="M12 44 v16"/><circle cx="6" cy="52" r="2.5"/><line x1="15" y1="48" x2="22" y2="48"/><line x1="15" y1="52" x2="22" y2="52"/>
    <rect x="60" y="36" width="4" height="24"/><rect x="66" y="30" width="4" height="30"/><rect x="72" y="36" width="4" height="24"/><rect x="78" y="42" width="4" height="18"/><line x1="57" y1="60" x2="85" y2="60"/>
    <path d="M110 54 l14-14 m-2-3 a5 5 0 0 0-8 5 l-8 8 a2.5 2.5 0 0 0 3.5 3.5 l8-8 a5 5 0 0 0 5-8z"/>
    <rect x="160" y="36" width="22" height="20" rx="2"/><line x1="160" y1="43" x2="182" y2="43"/><line x1="167" y1="36" x2="167" y2="41"/><line x1="177" y1="36" x2="177" y2="41"/><rect x="163" y="46" width="3" height="3"/><rect x="169" y="46" width="3" height="3"/><rect x="175" y="46" width="3" height="3"/><rect x="163" y="51" width="3" height="3"/><rect x="169" y="51" width="3" height="3"/>
    <line x1="210" y1="60" x2="210" y2="36"/><line x1="220" y1="60" x2="220" y2="36"/><line x1="210" y1="42" x2="220" y2="42"/><line x1="210" y1="48" x2="220" y2="48"/><line x1="210" y1="54" x2="220" y2="54"/>
    <line x1="265" y1="60" x2="265" y2="36"/><line x1="265" y1="36" x2="284" y2="36"/><line x1="284" y1="36" x2="284" y2="43"/><line x1="265" y1="36" x2="260" y2="43"/><line x1="274" y1="36" x2="274" y2="45"/><rect x="271" y="45" width="6" height="4"/>
    <rect x="320" y="36" width="24" height="20"/><line x1="332" y1="36" x2="332" y2="56"/><line x1="320" y1="46" x2="344" y2="46"/><rect x="322" y="38" width="8" height="6"/><rect x="334" y="48" width="8" height="6"/>
    <rect x="370" y="37" width="24" height="10" rx="2"/><rect x="374" y="32" width="16" height="7" rx="2"/><circle cx="376" cy="48" r="3"/><circle cx="390" cy="48" r="3"/>

    <line x1="4" y1="88" x2="14" y2="80"/><ellipse cx="4" cy="88" rx="5" ry="3" transform="rotate(-15,4,88)"/>
    <path d="M56 78 a3 3 0 0 1 6 0"/><path d="M52 73 a9 9 0 0 1 14 0"/><path d="M48 68 a13 13 0 0 1 22 0"/><circle cx="59" cy="80" r="1.5"/>
    <rect x="110" y="66" width="18" height="24"/><line x1="113" y1="72" x2="125" y2="72"/><line x1="113" y1="77" x2="125" y2="77"/><line x1="113" y1="82" x2="122" y2="82"/><line x1="113" y1="87" x2="125" y2="87"/>
    <rect x="160" y="66" width="22" height="26"/><path d="M164 92 v-9 a4 4 0 0 1 8 0 v9"/><rect x="174" y="83" width="5" height="9"/><rect x="163" y="70" width="4" height="4"/><rect x="170" y="70" width="4" height="4"/><rect x="163" y="77" width="4" height="4"/><rect x="170" y="77" width="4" height="4"/>
    <circle cx="215" cy="76" r="5"/><line x1="215" y1="66" x2="215" y2="63"/><line x1="215" y1="86" x2="215" y2="89"/><line x1="205" y1="76" x2="202" y2="76"/><line x1="225" y1="76" x2="228" y2="76"/><line x1="208" y1="69" x2="206" y2="67"/><line x1="222" y1="69" x2="224" y2="67"/>
    <rect x="268" y="66" width="16" height="22"/><rect x="270" y="69" width="4" height="5"/><rect x="278" y="69" width="4" height="5"/><rect x="270" y="77" width="4" height="5"/><rect x="278" y="77" width="4" height="5"/><rect x="273" y="83" width="5" height="5"/>
    <rect x="320" y="71" width="26" height="16" rx="2"/><path d="M332 71 v16"/><circle cx="326" cy="79" r="2.5"/><line x1="335" y1="75" x2="342" y2="75"/><line x1="335" y1="79" x2="342" y2="79"/><line x1="335" y1="83" x2="340" y2="83"/>
  `;

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="saproa-bg"
          x="0"
          y="0"
          width="400"
          height="100"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-12)"
        >
          <g
            fill="none"
            stroke={stroke}
            strokeWidth="1.05"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={opacity}
            dangerouslySetInnerHTML={{ __html: icons }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#saproa-bg)" />
    </svg>
  );
}
