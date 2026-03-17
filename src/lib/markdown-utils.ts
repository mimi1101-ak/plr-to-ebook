import type { Chapter, QualityScore } from "@/types";

export function parseMarkdownToChapters(content: string): {
  title: string;
  chapters: Chapter[];
} {
  const lines = content.split("\n");
  let title = "";

  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      break;
    }
  }

  const chapters: Chapter[] = [];
  let chapterTitle = "";
  let chapterLines: string[] = [];
  let chapterNum = 0;
  let inChapter = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inChapter && chapterTitle) {
        chapters.push({
          id: `ch-${chapterNum}`,
          number: chapterNum,
          title: chapterTitle,
          content: chapterLines.join("\n").trim(),
        });
      }

      const heading = line.slice(3).trim();
      if (heading === "목차" || heading.toLowerCase() === "table of contents") {
        inChapter = false;
        chapterTitle = "";
        chapterLines = [];
        continue;
      }

      const cleanTitle = heading.replace(/^\d+[\.\s]+/, "").trim();
      chapterNum++;
      chapterTitle = cleanTitle;
      chapterLines = [];
      inChapter = true;
    } else if (inChapter) {
      chapterLines.push(line);
    }
  }

  if (inChapter && chapterTitle) {
    chapters.push({
      id: `ch-${chapterNum}`,
      number: chapterNum,
      title: chapterTitle,
      content: chapterLines.join("\n").trim(),
    });
  }

  return { title: title || "전자책", chapters };
}

export function chaptersToMarkdown(title: string, chapters: Chapter[]): string {
  const tocLines = chapters.map((ch, i) => `${i + 1}. ${ch.title}`).join("\n");
  const chapterContent = chapters
    .map((ch, i) => `## ${i + 1}. ${ch.title}\n\n${ch.content}`)
    .join("\n\n---\n\n");
  return `# ${title}\n\n## 목차\n${tocLines}\n\n---\n\n${chapterContent}`;
}

const KO_KEYWORDS = [
  "인스타",
  "유튜브",
  "카카오",
  "네이버",
  "쿠팡",
  "배달",
  "국내",
  "한국",
  "서울",
  "한국인",
  "우리나라",
];

const TREND_KEYWORDS = [
  "AI",
  "인공지능",
  "숏폼",
  "1인 창작",
  "크리에이터",
  "콘텐츠",
  "SNS",
  "디지털",
  "자동화",
  "퍼스널 브랜딩",
  "알고리즘",
  "뉴미디어",
];

export function calculateQualityScore(chapters: Chapter[]): QualityScore {
  if (chapters.length === 0) {
    return {
      volumeScore: 0,
      localizationScore: 0,
      trendScore: 0,
      overallScore: 0,
      chaptersAbove3000: 0,
      totalChapters: 0,
    };
  }

  const chaptersAbove3000 = chapters.filter(
    (ch) => ch.content.length >= 3000
  ).length;
  const volumeScore = Math.round(
    (chaptersAbove3000 / chapters.length) * 100
  );

  const allContent = chapters.map((ch) => ch.title + " " + ch.content).join(" ");

  const koMatches = KO_KEYWORDS.filter((kw) => allContent.includes(kw)).length;
  const localizationScore = Math.min(
    100,
    Math.round((koMatches / KO_KEYWORDS.length) * 100 * 1.5)
  );

  const trendMatches = TREND_KEYWORDS.filter((kw) =>
    allContent.includes(kw)
  ).length;
  const trendScore = Math.min(
    100,
    Math.round((trendMatches / TREND_KEYWORDS.length) * 100 * 1.5)
  );

  const overallScore = Math.round(
    volumeScore * 0.5 + localizationScore * 0.3 + trendScore * 0.2
  );

  return {
    volumeScore,
    localizationScore,
    trendScore,
    overallScore,
    chaptersAbove3000,
    totalChapters: chapters.length,
  };
}

export function markdownToSimpleHtml(md: string): string {
  function esc(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  return md
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) return `<h3>${esc(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line === "---") return "<hr/>";
      if (line.trim() === "") return "<br/>";
      return `<p>${esc(line)}</p>`;
    })
    .join("\n");
}
