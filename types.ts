export enum PropertyType {
  RV_PARK = 'RV Park',
  MHP = 'Mobile Home Park',
  MULTIFAMILY = 'Multifamily',
}

export type FileCategory = 'rentRoll' | 't12' | 'pnl' | 'om' | 'capex' | 'utility' | 'financialInfo';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  category: FileCategory;
  file: File;
}

export interface DealFormData {
  // Section 1
  propertyName: string;
  propertyAddress: string;
  propertyType: PropertyType | '';
  unitCount: string;

  // Submitter Info
  submitterName: string;
  submitterPhone: string;
  submitterEmail: string;

  // Section 3 (Files are stored in a separate state array, but logically part of the form)

  // Section 4
  finalAcknowledgement: boolean;
}

export interface ValidationStatus {
  isValid: boolean;
  errors: Record<string, string>;
  missingRequirements: string[];
}