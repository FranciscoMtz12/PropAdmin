import { supabase } from "@/lib/supabaseClient";

export const INVOICE_STORAGE_BUCKET = "invoices";

export type UploadInvoiceFilesInput = {
  companyId: string;
  buildingId?: string | null;
  leaseId?: string | null;
  invoiceUuid?: string | null;
  invoiceId?: string | null;
  pdfFile?: File | null;
  xmlFile?: File | null;
};

export type UploadedInvoiceFiles = {
  pdfPath: string | null;
  xmlPath: string | null;
  originalPdfFilename: string | null;
  originalXmlFilename: string | null;
};

function sanitizePathSegment(value?: string | null) {
  const safe = String(value || "sin-dato").trim();

  return safe
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "bin" : "bin";
}

function buildInvoiceStorageBasePath({
  companyId,
  buildingId,
  leaseId,
  invoiceUuid,
  invoiceId,
}: {
  companyId: string;
  buildingId?: string | null;
  leaseId?: string | null;
  invoiceUuid?: string | null;
  invoiceId?: string | null;
}) {
  return [
    sanitizePathSegment(companyId),
    sanitizePathSegment(buildingId),
    sanitizePathSegment(leaseId),
    sanitizePathSegment(invoiceUuid || invoiceId || `invoice-${Date.now()}`),
  ].join("/");
}

async function uploadSingleFile({
  file,
  path,
  contentType,
}: {
  file: File;
  path: string;
  contentType: string;
}) {
  const { error } = await supabase.storage.from(INVOICE_STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message || "No fue posible subir el archivo.");
  }
}

export async function uploadInvoiceFiles({
  companyId,
  buildingId,
  leaseId,
  invoiceUuid,
  invoiceId,
  pdfFile,
  xmlFile,
}: UploadInvoiceFilesInput): Promise<UploadedInvoiceFiles> {
  const basePath = buildInvoiceStorageBasePath({
    companyId,
    buildingId,
    leaseId,
    invoiceUuid,
    invoiceId,
  });

  let pdfPath: string | null = null;
  let xmlPath: string | null = null;

  if (pdfFile) {
    const pdfExtension = getFileExtension(pdfFile.name) || "pdf";
    pdfPath = `${basePath}/invoice.${pdfExtension}`;

    await uploadSingleFile({
      file: pdfFile,
      path: pdfPath,
      contentType: pdfFile.type || "application/pdf",
    });
  }

  if (xmlFile) {
    const xmlExtension = getFileExtension(xmlFile.name) || "xml";
    xmlPath = `${basePath}/invoice.${xmlExtension}`;

    await uploadSingleFile({
      file: xmlFile,
      path: xmlPath,
      contentType: xmlFile.type || "application/xml",
    });
  }

  return {
    pdfPath,
    xmlPath,
    originalPdfFilename: pdfFile?.name || null,
    originalXmlFilename: xmlFile?.name || null,
  };
}

export async function removeInvoiceFile(path?: string | null) {
  if (!path) return;

  const { error } = await supabase.storage.from(INVOICE_STORAGE_BUCKET).remove([path]);

  if (error) {
    throw new Error(error.message || "No fue posible eliminar el archivo del bucket.");
  }
}

export async function createInvoiceSignedUrl(path?: string | null) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(INVOICE_STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 10);

  if (error) {
    throw new Error(error.message || "No fue posible generar el acceso temporal al archivo.");
  }

  return data?.signedUrl || null;
}