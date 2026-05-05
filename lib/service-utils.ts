export function shouldBillThisPeriod(
  meter: { billing_frequency: string; cycle_start_month: number | null; cycle_start_year: number | null },
  year: number,
  month: number
): boolean {
  if (meter.billing_frequency === 'monthly') return true
  if (!meter.cycle_start_month || !meter.cycle_start_year) return true
  const startDate  = new Date(meter.cycle_start_year, meter.cycle_start_month - 1)
  const targetDate = new Date(year, month - 1)
  const diffMonths =
    (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
    (targetDate.getMonth() - startDate.getMonth())
  return diffMonths >= 0 && diffMonths % 2 === 0
}
