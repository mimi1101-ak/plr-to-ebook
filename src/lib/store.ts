import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  TemplateSettings,
  WritingStyle,
  TocFormat,
  SentenceStructure,
} from "@/types";

interface AppState {
  currentProjectId: string | null;
  uploadedFile: {
    name: string;
    size: number;
    type: "docx" | "pdf";
  } | null;
  targetAudience: string | null;
  // templateSettings는 에디터의 AI 재생성 기능에서 사용
  templateSettings: TemplateSettings;

  setCurrentProjectId: (id: string | null) => void;
  setUploadedFile: (file: AppState["uploadedFile"]) => void;
  setTargetAudience: (t: string | null) => void;
  setWritingStyle: (style: WritingStyle) => void;
  setTocFormat: (format: TocFormat) => void;
  setSentenceStructure: (structure: SentenceStructure) => void;
  resetProject: () => void;
}

const defaultTemplateSettings: TemplateSettings = {
  writingStyle: "professional",
  tocFormat: "numbered",
  sentenceStructure: "medium",
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      uploadedFile: null,
      targetAudience: null,
      templateSettings: defaultTemplateSettings,

      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setUploadedFile: (file) => set({ uploadedFile: file }),
      setTargetAudience: (t) => set({ targetAudience: t }),
      setWritingStyle: (style) =>
        set((state) => ({
          templateSettings: { ...state.templateSettings, writingStyle: style },
        })),
      setTocFormat: (format) =>
        set((state) => ({
          templateSettings: { ...state.templateSettings, tocFormat: format },
        })),
      setSentenceStructure: (structure) =>
        set((state) => ({
          templateSettings: { ...state.templateSettings, sentenceStructure: structure },
        })),
      resetProject: () =>
        set({
          currentProjectId: null,
          uploadedFile: null,
          targetAudience: null,
          templateSettings: defaultTemplateSettings,
        }),
    }),
    {
      name: "plr-ebook-store",
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        uploadedFile: state.uploadedFile,
        targetAudience: state.targetAudience,
        templateSettings: state.templateSettings,
      }),
    }
  )
);
