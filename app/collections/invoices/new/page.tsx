"use client";

import { Suspense } from "react";
import InvoiceForm from "@/components/invoices/InvoiceForm";

/* InvoiceForm usa useSearchParams internamente; Suspense es requerido
   para que la página no rompa el prerender en producción. */
export default function NewInvoicePage() {
  return (
    <Suspense fallback={null}>
      <InvoiceForm mode="create" />
    </Suspense>
  );
}