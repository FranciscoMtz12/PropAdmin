"use client";

import { useSearchParams } from "next/navigation";

import InvoiceForm from "@/components/invoices/InvoiceForm";

export default function NewInvoicePage() {
  const searchParams = useSearchParams();
  const presetCollectionRecordId = searchParams.get("recordId");

  return (
    <InvoiceForm
      mode="create"
      presetCollectionRecordId={presetCollectionRecordId}
    />
  );
}
