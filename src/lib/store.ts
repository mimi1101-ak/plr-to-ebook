import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Project,
  TemplateSettings,
  WritingStyle,
  TocFormat,
  SentenceStructure,
  GeneratedToc,
} from "@/types";

interface AppState {
  // 현재 작업 중인 프로젝트
  currentProjectId: string | null;
  uploadedFile: {
    name: string;
    size: number;
    type: "docx" | "pdf";
  } | null;
  templateSettings: TemplateSettings;
  generatedToc: GeneratedToc | null;

  // 액션
  setCurrentProjectId: (id: string | null) => void;
  setUploadedFile: (file: AppState["uploadedFile"]) => void;
  setWritingStyle: (style: WritingStyle) => void;
  setTocFormat: (format: TocFormat) => void;
  setSentenceStructure: (structure: SentenceStructure) => void;
  setGeneratedToc: (toc: GeneratedToc | null) => void;
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
      templateSettings: defaultTemplateSettings,
      generatedToc: null,

      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setUploadedFile: (file) => set({ uploadedFile: file }),
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
          templateSettings: {
            ...state.templateSettings,
            sentenceStructure: structure,
          },
        })),
      setGeneratedToc: (toc) => set({ generatedToc: toc }),
      resetProject: () =>
        set({
          currentProjectId: null,
          uploadedFile: null,
          templateSettings: defaultTemplateSettings,
          generatedToc: null,
        }),
    }),
    {
      name: "plr-ebook-store",
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        uploadedFile: state.uploadedFile,
        templateSettings: state.templateSettings,
        generatedToc: state.generatedToc,
      }),
    }
  )
);
