/*
  Código preservado — funcionalidad de Cargo Manual y accesos rápidos.
  Pendiente de reimplementar en collections/page.tsx cuando sea necesario.

  Para restaurar:
  1. Importar useRouter desde next/navigation
  2. Importar FileText, Upload desde lucide-react
  3. Descomentar tipos, estados, useMemos y función
  4. Restaurar botones en el header (<PageHeader actions={...}>)
  5. Restaurar quick links en la sección de gráfica
  6. Restaurar el Modal de Cargo manual
*/

// ── Tipos preservados ─────────────────────────────────────────────────────────

// type ChargeMode = "recurring" | "one_time";

// type ChargeForm = {
//   chargeMode: ChargeMode;
//   buildingId: string;
//   unitId: string;
//   leaseId: string;
//   chargeType: CollectionChargeType;
//   title: string;
//   responsibilityType: "tenant" | "owner" | "other";
//   amountExpected: string;
//   dueDay: string;
//   initialDueDate: string;
//   notes: string;
//   createFirstRecordNow: boolean;
// };

// ── createDefaultChargeForm ───────────────────────────────────────────────────

// function createDefaultChargeForm(): ChargeForm {
//   const today = getTodayDateKey();
//   const day = new Date().getDate();
//   return {
//     chargeMode: "recurring",
//     buildingId: "", unitId: "", leaseId: "",
//     chargeType: "rent",
//     title: "",
//     responsibilityType: "tenant",
//     amountExpected: "",
//     dueDay: String(day),
//     initialDueDate: today,
//     notes: "",
//     createFirstRecordNow: true,
//   };
// }

// ── Estados ───────────────────────────────────────────────────────────────────

// const [createChargeOpen, setCreateChargeOpen] = useState(false);
// const [chargeForm, setChargeForm]             = useState<ChargeForm>(createDefaultChargeForm());
// const [creatingCharge, setCreatingCharge]     = useState(false);

// ── useMemos ──────────────────────────────────────────────────────────────────

// const unitsForBuilding = useMemo(
//   () => units.filter((u) => u.building_id === chargeForm.buildingId),
//   [units, chargeForm.buildingId],
// );
// const leasesForUnit = useMemo(
//   () => leases.filter((l) => l.unit_id === chargeForm.unitId),
//   [leases, chargeForm.unitId],
// );

// ── handleCreateCharge ────────────────────────────────────────────────────────

// async function handleCreateCharge() {
//   if (!user?.company_id) return;
//
//   if (!chargeForm.buildingId) { showToast({ type: "error", message: "Selecciona un edificio." }); return; }
//   if (!chargeForm.unitId)     { showToast({ type: "error", message: "Selecciona una unidad." }); return; }
//
//   const amountExpected = parsePositiveNumber(chargeForm.amountExpected);
//   if (!amountExpected) { showToast({ type: "error", message: "Ingresa un monto válido." }); return; }
//   if (!chargeForm.title.trim()) { showToast({ type: "error", message: "Escribe el concepto del cobro." }); return; }
//   if (!chargeForm.initialDueDate) { showToast({ type: "error", message: "Selecciona una fecha de vencimiento." }); return; }
//
//   const dueDateObj = new Date(`${chargeForm.initialDueDate}T00:00:00`);
//   const derivedDueDay =
//     chargeForm.chargeMode === "recurring"
//       ? Number(chargeForm.dueDay || dueDateObj.getDate())
//       : dueDateObj.getDate();
//
//   setCreatingCharge(true);
//
//   const { data: insertedSchedule, error: scheduleError } = await supabase
//     .from("collection_schedules")
//     .insert({
//       company_id: user.company_id,
//       building_id: chargeForm.buildingId,
//       unit_id: chargeForm.unitId,
//       lease_id: chargeForm.leaseId || null,
//       charge_type: chargeForm.chargeType,
//       title: chargeForm.title.trim(),
//       responsibility_type: chargeForm.responsibilityType,
//       amount_expected: amountExpected,
//       due_day: derivedDueDay,
//       active: chargeForm.chargeMode === "recurring",
//       notes: chargeForm.notes.trim() || null,
//     })
//     .select("id")
//     .single();
//
//   if (scheduleError || !insertedSchedule) {
//     showToast({ type: "error", message: "No se pudo crear la configuración del cobro." });
//     setCreatingCharge(false);
//     return;
//   }
//
//   const shouldCreateRecord = chargeForm.chargeMode === "one_time" || chargeForm.createFirstRecordNow;
//
//   if (shouldCreateRecord) {
//     const today = getTodayDateKey();
//     const { error: recordError } = await supabase.from("collection_records").insert({
//       collection_schedule_id: insertedSchedule.id,
//       company_id: user.company_id,
//       building_id: chargeForm.buildingId,
//       unit_id: chargeForm.unitId,
//       lease_id: chargeForm.leaseId || null,
//       period_year: dueDateObj.getFullYear(),
//       period_month: dueDateObj.getMonth() + 1,
//       due_date: chargeForm.initialDueDate,
//       amount_due: amountExpected,
//       amount_collected: 0,
//       status: chargeForm.initialDueDate < today ? "overdue" : "pending",
//       collected_at: null,
//       payment_method: null,
//       notes: chargeForm.notes.trim() || null,
//     });
//
//     if (recordError) {
//       // Rollback schedule
//       await supabase.from("collection_schedules").update({ deleted_at: new Date().toISOString() }).eq("id", insertedSchedule.id);
//       showToast({ type: "error", message: recordError.message.includes("unique") ? "Ya existe un cobro para ese periodo." : "No se pudo crear el primer registro del cobro." });
//       setCreatingCharge(false);
//       return;
//     }
//   }
//
//   await loadData();
//   setCreatingCharge(false);
//   setCreateChargeOpen(false);
//   setChargeForm(createDefaultChargeForm());
//   showToast({ type: "success", message: chargeForm.chargeMode === "recurring" ? "Cobro recurrente creado." : "Cargo adicional creado." });
// }

// ── Botones del header ────────────────────────────────────────────────────────

// <UiButton
//   variant="secondary"
//   onClick={() => router.push("/collections/invoices")}
//   icon={<FileText size={15} />}
// >
//   Ver historial
// </UiButton>
//
// <UiButton
//   variant="secondary"
//   onClick={() => { setChargeForm(createDefaultChargeForm()); setCreateChargeOpen(true); }}
//   icon={<Plus size={15} />}
// >
//   Cargo manual
// </UiButton>

// ── Accesos rápidos (chartRow, segunda columna) ───────────────────────────────

// <div style={quickLinksGridStyle}>
//   <button type="button" onClick={() => router.push("/collections/reported-payments")} style={quickLinkCardStyle}>
//     <div style={quickLinkIconStyle}><Upload size={18} /></div>
//     <span style={quickLinkLabelStyle}>Pagos reportados</span>
//   </button>
//   <button type="button" onClick={() => router.push("/collections/invoice-generation")} style={quickLinkCardStyle}>
//     <div style={quickLinkIconStyle}><FileText size={18} /></div>
//     <span style={quickLinkLabelStyle}>Generación de facturas</span>
//   </button>
//   <button type="button" onClick={() => router.push("/collections/invoices")} style={quickLinkCardStyle}>
//     <div style={quickLinkIconStyle}><Receipt size={18} /></div>
//     <span style={quickLinkLabelStyle}>Facturas importadas</span>
//   </button>
//   <button type="button" onClick={() => router.push("/collections/pending-invoice-uploads")} style={quickLinkCardStyle}>
//     <div style={quickLinkIconStyle}><Upload size={18} /></div>
//     <span style={quickLinkLabelStyle}>Falta cargar factura</span>
//   </button>
// </div>

// ── Modal: Cargo manual ───────────────────────────────────────────────────────

// <Modal
//   open={createChargeOpen}
//   title="Nuevo cobro"
//   onClose={() => { if (!creatingCharge) { setCreateChargeOpen(false); setChargeForm(createDefaultChargeForm()); } }}
// >
//   <div style={{ display: "grid", gap: 16 }}>
//     <div style={formGridStyle}>
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Tipo de cobro</span>
//         <AppSelect
//           value={chargeForm.chargeMode}
//           onChange={(e) => setChargeForm((p) => ({ ...p, chargeMode: e.target.value as ChargeMode, createFirstRecordNow: e.target.value === "recurring" }))}
//         >
//           <option value="recurring">Recurrente</option>
//           <option value="one_time">Único / cargo adicional</option>
//         </AppSelect>
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Categoría</span>
//         <AppSelect value={chargeForm.chargeType} onChange={(e) => setChargeForm((p) => ({ ...p, chargeType: e.target.value as CollectionChargeType }))}>
//           <option value="rent">Renta</option>
//           <option value="maintenance_fee">Mantenimiento</option>
//           <option value="electricity">Electricidad</option>
//           <option value="water">Agua</option>
//           <option value="gas">Gas</option>
//           <option value="amenities">Amenidades</option>
//           <option value="parking">Estacionamiento</option>
//           <option value="penalty">Penalización</option>
//           <option value="other">Otro</option>
//         </AppSelect>
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Edificio</span>
//         <AppSelect
//           value={chargeForm.buildingId}
//           onChange={(e) => setChargeForm((p) => ({ ...p, buildingId: e.target.value, unitId: "", leaseId: "" }))}
//         >
//           <option value="">Selecciona un edificio</option>
//           {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
//         </AppSelect>
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Unidad</span>
//         <AppSelect
//           value={chargeForm.unitId}
//           onChange={(e) => setChargeForm((p) => ({ ...p, unitId: e.target.value, leaseId: "" }))}
//           disabled={!chargeForm.buildingId}
//         >
//           <option value="">Selecciona una unidad</option>
//           {unitsForBuilding.map((u) => <option key={u.id} value={u.id}>{u.display_code || u.unit_number || "Unidad"}</option>)}
//         </AppSelect>
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Contrato</span>
//         <AppSelect
//           value={chargeForm.leaseId}
//           onChange={(e) => setChargeForm((p) => ({ ...p, leaseId: e.target.value }))}
//           disabled={!chargeForm.unitId}
//         >
//           <option value="">Sin contrato específico</option>
//           {leasesForUnit.map((l) => {
//             const t = l.tenant_id ? tenantMap.get(l.tenant_id) : null;
//             return <option key={l.id} value={l.id}>{t?.full_name || l.billing_name || "Contrato"}</option>;
//           })}
//         </AppSelect>
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Concepto</span>
//         <input
//           value={chargeForm.title}
//           onChange={(e) => setChargeForm((p) => ({ ...p, title: e.target.value }))}
//           style={inputStyle}
//           placeholder="Ej. Renta abril o cargo extraordinario"
//         />
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>Monto</span>
//         <input
//           value={chargeForm.amountExpected}
//           onChange={(e) => setChargeForm((p) => ({ ...p, amountExpected: formatDecimalInput(e.target.value) }))}
//           style={inputStyle}
//           inputMode="decimal"
//           placeholder="0.00"
//         />
//       </label>
//
//       <label style={fieldStyle}>
//         <span style={fieldLabelStyle}>{chargeForm.chargeMode === "recurring" ? "Primer vencimiento" : "Vencimiento"}</span>
//         <input
//           type="date"
//           value={chargeForm.initialDueDate}
//           onChange={(e) => {
//             const parsed = new Date(`${e.target.value}T00:00:00`);
//             setChargeForm((p) => ({
//               ...p,
//               initialDueDate: e.target.value,
//               dueDay: p.chargeMode === "recurring" ? String(parsed.getDate()) : p.dueDay,
//             }));
//           }}
//           style={inputStyle}
//         />
//       </label>
//
//       {chargeForm.chargeMode === "recurring" ? (
//         <>
//           <label style={fieldStyle}>
//             <span style={fieldLabelStyle}>Día de vencimiento mensual</span>
//             <AppSelect value={chargeForm.dueDay} onChange={(e) => setChargeForm((p) => ({ ...p, dueDay: e.target.value }))}>
//               {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
//                 <option key={d} value={String(d)}>Día {d}</option>
//               ))}
//             </AppSelect>
//           </label>
//
//           <label style={{ ...fieldStyle, flexDirection: "row", alignItems: "center", gap: 10 }}>
//             <input
//               type="checkbox"
//               checked={chargeForm.createFirstRecordNow}
//               onChange={(e) => setChargeForm((p) => ({ ...p, createFirstRecordNow: e.target.checked }))}
//             />
//             <span style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 500 }}>
//               Crear primer cobro ahora
//             </span>
//           </label>
//         </>
//       ) : null}
//     </div>
//
//     <label style={fieldStyle}>
//       <span style={fieldLabelStyle}>Notas</span>
//       <textarea
//         value={chargeForm.notes}
//         onChange={(e) => setChargeForm((p) => ({ ...p, notes: e.target.value }))}
//         rows={3}
//         style={textareaStyle}
//         placeholder="Notas internas opcionales"
//       />
//     </label>
//
//     <div style={modalFooterStyle}>
//       <UiButton variant="secondary" onClick={() => { if (!creatingCharge) { setCreateChargeOpen(false); setChargeForm(createDefaultChargeForm()); } }}>
//         Cancelar
//       </UiButton>
//       <UiButton onClick={handleCreateCharge} disabled={creatingCharge} icon={<Plus size={15} />}>
//         {creatingCharge ? "Guardando..." : "Guardar cobro"}
//       </UiButton>
//     </div>
//   </div>
// </Modal>

// ── Estilos preservados ────────────────────────────────────────────────────────

// const quickLinksGridStyle: CSSProperties = {
//   display: "grid",
//   gridTemplateColumns: "repeat(auto-fit, minmax(8.75rem, 1fr))",
//   gap: 12,
// };
//
// const quickLinkCardStyle: CSSProperties = {
//   display: "flex",
//   flexDirection: "column",
//   alignItems: "flex-start",
//   gap: 10,
//   padding: "16px 14px",
//   borderRadius: 16,
//   border: "1px solid var(--border-default)",
//   background: "var(--bg-card)",
//   cursor: "pointer",
//   textAlign: "left",
// };
//
// const quickLinkIconStyle: CSSProperties = {
//   width: 36,
//   height: 36,
//   borderRadius: 10,
//   background: "var(--icon-bg-neutral)",
//   color: "var(--icon-color-neutral)",
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   flexShrink: 0,
// };
//
// const quickLinkLabelStyle: CSSProperties = {
//   fontSize: "0.8125rem",
//   fontWeight: 600,
//   color: "var(--text-primary)",
// };

export {};
