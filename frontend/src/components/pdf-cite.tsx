"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import type { TutorCitation } from "@/lib/api";

export function CiteViewer({
  cite,
  documentUrl,
  documentTitle,
  mimeType,
  onClose,
}: {
  cite: TutorCitation;
  documentUrl?: string | null;
  documentTitle?: string;
  mimeType?: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("");
  const isPdf = (mimeType || "").includes("pdf") && Boolean(documentUrl);
  const page = cite.page || 1;

  useEffect(() => {
    if (!isPdf || !documentUrl) return;
    const url = documentUrl;
    let gone = false;
    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ url, withCredentials: false }).promise;
        const pdfPage = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
        const viewport = pdfPage.getViewport({ scale: 1.15 });
        if (gone) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
        const content = await pdfPage.getTextContent();
        const needle = (cite.quote || cite.snippet).toLowerCase().replace(/\s+/g, " ").trim();
        if (!needle) return;
        context.save();
        context.globalAlpha = 0.32;
        context.fillStyle = "#f3c14b";
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const hay = item.str.toLowerCase().replace(/\s+/g, " ").trim();
          if (hay.length < 4 || (!needle.includes(hay) && !hay.includes(needle.slice(0, 24)))) continue;
          const tx = item.transform[4];
          const ty = item.transform[5];
          const [x, y] = viewport.convertToViewportPoint(tx, ty);
          const width = (item.width || 40) * viewport.scale;
          const height = (item.height || 10) * viewport.scale;
          context.fillRect(x, y - height, Math.max(width, 24), height + 3);
        }
        context.restore();
      } catch {
        if (!gone) setStatus("Open the PDF to see this page.");
      }
    }
    void render();
    return () => {
      gone = true;
    };
  }, [cite.quote, cite.snippet, documentUrl, isPdf, page]);

  return (
    <div className="tutor-cite-scrim" onClick={onClose} role="presentation">
      <div className="tutor-cite" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header>
          <div>
            <p className="tutor-kicker">Your notes</p>
            <h2>{cite.page ? `Page ${cite.page}` : "Highlighted passage"}</h2>
            <p className="muted">{documentTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icon icon={Cancel01Icon} size={18} />
          </button>
        </header>
        <blockquote>{cite.quote || cite.snippet}</blockquote>
        {isPdf && <canvas ref={canvasRef} className="tutor-cite-page" />}
        {status && <p className="muted text-sm">{status}</p>}
        {documentUrl && (
          <a href={`${documentUrl}${cite.page ? `#page=${cite.page}` : ""}`} target="_blank" rel="noreferrer">
            Open original PDF
          </a>
        )}
      </div>
    </div>
  );
}
