export type ProjectStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TocSection {
  id: string;
  type: "prologue" | "chapter" | "appendix";
  number?: number;
  title: string;
  subtitles: string[];
}

export interface GeneratedToc {
  bookTitle: string;
  sections: TocSection[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
}

export interface QualityScore {
  volumeScore: number;       // 0-100: 챕터당 3000자 충족률
  localizationScore: number; // 0-100: 한국어 현지화
  trendScore: number;        // 0-100: 2026 트렌드 반영
  overallScore: number;      // 0-100: 종합
  chaptersAbove3000: number;
  totalChapters: number;
}

export type WritingStyle =
  | "professional"
  | "casual"
  | "academic"
  | "storytelling";

export type TocFormat = "numbered" | "bulleted" | "none";

export type SentenceStructure = "short" | "medium" | "long";

export interface TemplateSettings {
  writingStyle: WritingStyle;
  tocFormat: TocFormat;
  sentenceStructure: SentenceStructure;
}

export interface Project {
  id: string;
  createdAt: string;
  updatedAt: string;
  originalFileName: string;
  originalFileUrl: string;
  fileType: "docx" | "pdf";
  fileSize: number;
  writingStyle: WritingStyle;
  tocFormat: TocFormat;
  sentenceStructure: SentenceStructure;
  status: ProjectStatus;
  progress: number;
  ebookTitle?: string;
  ebookContent?: string;
  ebookFileUrl?: string;
  pageCount?: number;
  wordCount?: number;
  errorMessage?: string;
}

export interface UploadResponse {
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: "docx" | "pdf";
}

export interface ProcessingStatus {
  status: ProjectStatus;
  progress: number;
  message: string;
  ebookTitle?: string;
  ebookFileUrl?: string;
  pageCount?: number;
  wordCount?: number;
  errorMessage?: string;
}

export const STYLE_LABELS: Record<WritingStyle, string> = {
  professional: "전문적",
  casual: "친근한",
  academic: "학술적",
  storytelling: "스토리텔링",
};

export const STYLE_DESCRIPTIONS: Record<WritingStyle, string> = {
  professional: "비즈니스 보고서처럼 명확하고 격식 있는 문체",
  casual: "독자와 대화하듯 편안하고 읽기 쉬운 문체",
  academic: "논문처럼 체계적이고 인용·참조가 풍부한 문체",
  storytelling: "흥미로운 사례와 서사로 독자를 끌어당기는 문체",
};

export const TOC_LABELS: Record<TocFormat, string> = {
  numbered: "번호형 (1. 2. 3.)",
  bulleted: "글머리표 (• • •)",
  none: "목차 없음",
};

export const SENTENCE_LABELS: Record<SentenceStructure, string> = {
  short: "짧고 간결",
  medium: "중간 길이",
  long: "길고 상세",
};
