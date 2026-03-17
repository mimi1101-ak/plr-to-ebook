import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMarkdownToChapters, markdownToSimpleHtml } from "@/lib/markdown-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { ebookTitle: true, ebookContent: true, status: true },
    });

    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    if (project.status !== "COMPLETED" || !project.ebookContent) {
      return NextResponse.json({ message: "아직 변환이 완료되지 않았습니다." }, { status: 400 });
    }

    const format = request.nextUrl.searchParams.get("format") ?? "md";
    const title = (project.ebookTitle ?? "ebook").replace(/[^a-zA-Z0-9가-힣\s]/g, "").trim();

    switch (format) {
      case "docx":
        return await serveDocx(title, project.ebookContent);
      case "pdf":
        return await servePdf(title, project.ebookContent);
      case "epub":
        return await serveEpub(title, project.ebookContent);
      default:
        return serveMarkdown(title, project.ebookContent);
    }
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ message: "다운로드에 실패했습니다." }, { status: 500 });
  }
}

function serveMarkdown(title: string, content: string): NextResponse {
  const fileName = `${title}.md`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

async function serveDocx(title: string, content: string): Promise<NextResponse> {
  const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = await import("docx");
  const { chapters } = parseMarkdownToChapters(content);

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: "" }),
  ];

  for (const chapter of chapters) {
    children.push(
      new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1 })
    );

    for (const line of chapter.content.split("\n")) {
      if (line.startsWith("### ")) {
        children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (line.startsWith("## ")) {
        children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (line === "---" || line.trim() === "") {
        children.push(new Paragraph({ text: "" }));
      } else {
        children.push(new Paragraph({ text: line }));
      }
    }
    children.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const fileName = `${title}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

async function servePdf(title: string, content: string): Promise<NextResponse> {
  const PDFDocument = (await import("pdfkit")).default;
  const { chapters } = parseMarkdownToChapters(content);

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title page
    doc.fontSize(24).text(title, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text("* 한국어 텍스트는 별도 폰트 설정이 필요합니다.", { align: "center" });

    for (const chapter of chapters) {
      doc.addPage();
      doc.fontSize(18).text(chapter.title, { align: "left" });
      doc.moveDown(0.5);
      // pdfkit default fonts do not support CJK; content is included but may render as boxes
      doc.fontSize(11).text(chapter.content, { align: "left", lineGap: 4 });
    }

    doc.end();
  });

  const fileName = `${title}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

async function serveEpub(title: string, content: string): Promise<NextResponse> {
  const JSZip = (await import("jszip")).default;
  const { chapters } = parseMarkdownToChapters(content);
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:schemas:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const uid = `urn:uuid:${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const manifestItems = chapters
    .map(
      (_, i) =>
        `<item id="chapter${i + 1}" href="chapters/chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("\n    ");

  const spineItems = chapters
    .map((_, i) => `<itemref idref="chapter${i + 1}"/>`)
    .join("\n    ");

  function esc(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${esc(title)}</dc:title>
    <dc:language>ko</dc:language>
    <dc:identifier id="bookid">${uid}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`
  );

  const navPoints = chapters
    .map(
      (ch, i) =>
        `  <navPoint id="navpoint${i + 1}" playOrder="${i + 1}">
    <navLabel><text>${esc(ch.title)}</text></navLabel>
    <content src="chapters/chapter${i + 1}.xhtml"/>
  </navPoint>`
    )
    .join("\n");

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uid}"/>
  </head>
  <docTitle><text>${esc(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
  );

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const htmlBody = markdownToSimpleHtml(ch.content);
    zip.file(
      `OEBPS/chapters/chapter${i + 1}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko">
<head>
  <title>${esc(ch.title)}</title>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <style>body{font-family:serif;line-height:1.8;margin:2em;}h1,h2,h3{margin-top:1.5em;}p{margin:0.5em 0;}</style>
</head>
<body>
  <h1>${esc(ch.title)}</h1>
  ${htmlBody}
</body>
</html>`
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const fileName = `${title}.epub`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
