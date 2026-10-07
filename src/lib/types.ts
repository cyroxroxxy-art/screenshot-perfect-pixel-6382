export type ContentType = "text" | "table" | "chart" | "graph" | "image" | "scanned";
export type Confidence = "high" | "medium" | "low";

export interface DocumentRecord {
  id: string;
  filename: string;
  upload_status: string;
  page_count: number;
  is_demo: boolean;
  created_at: string;
}

export interface PageSummary {
  page_number: number;
  content_type: ContentType;
  has_visuals: boolean;
  section: string | null;
  processing_status: string;
  text_length: number;
}

export interface DocumentWithPages extends DocumentRecord {
  pages: PageSummary[];
}

export interface PageDetail {
  documentId: string;
  documentName: string;
  pageNumber: number;
  pageCount: number;
  extractedText: string;
  section: string | null;
  contentType: ContentType;
  imageUrl: string | null;
}

export interface Citation {
  documentId: string | null;
  documentName: string;
  pageNumber: number;
  section: string;
  evidence: string;
  contentType: ContentType;
  verified: boolean;
  visualSource: boolean;
}

export interface CalculationResult {
  label: string;
  operation: string;
  inputs: { label: string; value: number }[];
  formula: string;
  result: number | null;
  display: string;
  unit: string;
}

export interface AnalysisResponse {
  answer: string;
  confidence: Confidence;
  citations: Citation[];
  calculations: CalculationResult[];
  limitations: string[];
  pagesConsidered: { documentName: string; pageNumber: number; imageSent: boolean }[];
}

export interface SelectedPage {
  documentId: string;
  pageNumber: number;
}
