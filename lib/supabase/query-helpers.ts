// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withCompanyFilter(query: any, companyId: string | null) {
  if (companyId) return query.eq("company_id", companyId);
  return query; // sin filtro — RLS vía can_access_company() maneja el acceso
}
