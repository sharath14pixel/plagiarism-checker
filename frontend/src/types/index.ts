export interface MatchedSource {
  text: string;
  source: string;
  similarity: number;
  type: string;
}

export interface AIFlaggedSegment {
  text: string;
  confidence: number;
}

export interface CombinedReport {
  report_id: number;
  filename: string;
  full_text: string;
  plagiarism_percentage: number;
  ai_generated_percentage: number;
  matched_sources: MatchedSource[];
  ai_flagged_segments: AIFlaggedSegment[];
  created_at: string;
  user_id?: string;
  word_count: number;
  total_chunks: number;
  internal_percentage: number;
  web_percentage: number;
  ai_label: string;
  document_id: number;
}

export interface ReportSummary {
  report_id: number;
  filename: string;
  plagiarism_percentage: number;
  ai_generated_percentage: number;
  ai_label: string;
  created_at: string;
  user_id?: string;
}
