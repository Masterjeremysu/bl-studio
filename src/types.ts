export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Template {
  id: string;
  supplierName: string;
  sampleImage: string;
  pageImages?: string[];
  zones: Zone[];
  createdAt: number;
  updatedAt?: number;
  accentColor?: string;
  totalProcessed?: number;
}

export interface ExtractionResult {
  [label: string]: string;
}

export type ProcessingStatus = 'pending' | 'converting' | 'identifying' | 'extracting' | 'success' | 'error';

export interface BatchItem {
  id: string;
  file: File;
  imageBase64?: string;
  allPagesBase64?: string[];
  status: ProcessingStatus;
  templateId?: string;
  result?: ExtractionResult;
  error?: string;
  retryCount?: number;
  processedAt?: number;
}

export interface AppStats {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
}

export type Theme = 'dark' | 'light' | 'auto';
