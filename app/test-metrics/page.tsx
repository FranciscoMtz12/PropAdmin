export default function TestMetricsPage() {
  const sections: { count: number; metrics: { value: string; label: string }[] }[] = [
    {
      count: 3,
      metrics: [
        { value: "$42K", label: "Ingresos" },
        { value: "$18K", label: "Gastos" },
        { value: "57%", label: "Margen" },
      ],
    },
    {
      count: 4,
      metrics: [
        { value: "$42K", label: "Ingresos" },
        { value: "$18K", label: "Gastos" },
        { value: "57%", label: "Margen" },
        { value: "92%", label: "Ocup." },
      ],
    },
    {
      count: 5,
      metrics: [
        { value: "$42K", label: "Ingresos" },
        { value: "$18K", label: "Gastos" },
        { value: "57%", label: "Margen" },
        { value: "92%", label: "Ocup." },
        { value: "8", label: "Deuda" },
      ],
    },
    {
      count: 6,
      metrics: [
        { value: "$42K", label: "Ingresos" },
        { value: "$18K", label: "Gastos" },
        { value: "57%", label: "Margen" },
        { value: "92%", label: "Ocup." },
        { value: "8", label: "Deuda" },
        { value: "$8K", label: "Renta" },
      ],
    },
    {
      count: 7,
      metrics: [
        { value: "$42K", label: "Ingresos" },
        { value: "$18K", label: "Gastos" },
        { value: "57%", label: "Margen" },
        { value: "92%", label: "Ocup." },
        { value: "8", label: "Deuda" },
        { value: "$8K", label: "Renta" },
        { value: "12%", label: "ROI" },
      ],
    },
    {
      count: 8,
      metrics: [
        { value: "$42K", label: "Ingresos" },
        { value: "$18K", label: "Gastos" },
        { value: "57%", label: "Margen" },
        { value: "92%", label: "Ocup." },
        { value: "8", label: "Deuda" },
        { value: "$8K", label: "Renta" },
        { value: "12%", label: "ROI" },
        { value: "3.2", label: "IPC" },
      ],
    },
  ];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0f1117",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "4px", color: "#94a3b8" }}>
        TEST: METRIC CIRCLES
      </h1>
      <p style={{ fontSize: "0.7rem", color: "#475569", marginBottom: "24px" }}>
        Viewport: <span id="vp" /> — Redimensiona o abre en mobile real
      </p>

      {sections.map(({ count, metrics }) => {
        const numFs = `calc((100vw - 32px) / ${count} * 0.27)`;
        const lblFs = `calc((100vw - 32px) / ${count} * 0.13)`;

        return (
          <section key={count} style={{ marginBottom: "28px" }}>
            <div
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#475569",
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              {count} métricas
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
                gap: "6px",
              }}
            >
              {metrics.map((m, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "50%",
                    background: "rgba(99,102,241,0.15)",
                    border: "1.5px solid rgba(99,102,241,0.35)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: numFs,
                      fontWeight: 700,
                      lineHeight: 1.1,
                      color: "#e2e8f0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.value}
                  </span>
                  <span
                    style={{
                      fontSize: lblFs,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      color: "#94a3b8",
                      whiteSpace: "nowrap",
                      marginTop: "2px",
                    }}
                  >
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Show live viewport width */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            function updateVp(){var el=document.getElementById('vp');if(el)el.textContent=window.innerWidth+'×'+window.innerHeight+'px';}
            updateVp();
            window.addEventListener('resize',updateVp);
          `,
        }}
      />
    </div>
  );
}
