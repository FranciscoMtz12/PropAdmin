/**
 * Shared props for all non-residential wizard profiles.
 * Each profile receives these and mounts its own WizardShell.
 */
export interface NonResidentialProps {
  open: boolean;
  propertyId: string;
  companyId: string;
  spaceType: string;
  editTemplate?: {
    id: string;
    name: string;
    wizard_state?: Record<string, unknown> | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export type AssetRow = {
  asset_type: string;
  name: string;
  status: string;
  notes: string | null;
  sort_order: number;
};
