"use client";

import {
  Cancel01Icon,
  File01Icon,
  Image01Icon,
  Loading03Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { DragEvent, useEffect, useRef, useState } from "react";
import { CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { PageHeader, ProgressBar, Steps } from "@/components/ui";
import { api, DocumentRecord, StudySet } from "@/lib/api";
import { useUploadThing } from "@/lib/uploadthing";

const formats = [
  { key: "explanation", label: "Short explanations", hint: "Read the ideas first", max: 10 },
  { key: "mcq", label: "Quiz questions", hint: "Multiple choice with instant feedback", max: 300 },
  { key: "flashcard", label: "Flashcards", hint: "Flip and review", max: 20 },
] as const;

type Stage = "idle" | "uploading" | "reading" | "generating";

const ACCEPT = ".pdf,.txt,.pptx,image/png,image/jpeg,image/webp";

function fileKind(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (type === "text/plain" || name.endsWith(".txt")) return "txt";
  if (name.endsWith(".pptx") || type.includes("presentationml")) return "pptx";
  return "";
}

function mimeFor(file: File) {
  const kind = fileKind(file);
  if (kind === "txt") return "text/plain";
  if (kind === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") return file.type || "image/jpeg";
  return file.type;
}

const pipeline = [
  { id: "uploading" as const, label: "Upload notes", copy: "Sending your file to Cado." },
  { id: "reading" as const, label: "Read & embed", copy: "Extracting text and indexing the ideas." },
  { id: "generating" as const, label: "Write the set", copy: "Building explanations, flashcards, and quiz questions." },
];

function stageIndex(stage: Stage) {
  return pipeline.findIndex((item) => item.id === stage);
}

export default function UploadPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [language, setLanguage] = useState("English");
  const [outputs, setOutputs] = useState({ explanation: true, mcq: true, flashcard: true });
  const [counts, setCounts] = useState({ explanation: 3, mcq: 5, flashcard: 5 });
  const [explanationMode, setExplanationMode] = useState<"count" | "full">("count");
  const [focus, setFocus] = useState("");
  const [optionCount, setOptionCount] = useState(4);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [statusNote, setStatusNote] = useState("");
  const [error, setError] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const uploadError = useRef("");
  const { startUpload } = useUploadThing("studyMaterial", {
    onUploadError(error) {
      uploadError.current = error.message;
    },
  });

  const working = stage !== "idle" && !error;

  useEffect(() => {
    if (!working) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [working]);

  useEffect(() => {
    if (stage === "idle" || error) return;
    const floor = stage === "uploading" ? 8 : stage === "reading" ? 28 : 62;
    const ceiling = stage === "uploading" ? 24 : stage === "reading" ? 58 : 92;
    setProgress((current) => Math.max(current, floor));
    const timer = window.setInterval(() => {
      setProgress((current) => (current >= ceiling ? current : current + 1));
    }, stage === "generating" ? 900 : 400);
    return () => window.clearInterval(timer);
  }, [stage, error]);

  function choose(selected?: File) {
    if (!selected) return;
    if (selected.size > 16 * 1024 * 1024) return setError("Please choose a file under 16 MB.");
    if (!fileKind(selected)) return setError("Use a PDF, photo, TXT, or PPTX file.");
    setFile(selected);
    setError("");
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  function fail(reason: unknown) {
    setError(reason instanceof Error ? reason.message : "Generation failed");
    setStatusNote("Stopped. You can retry from here.");
  }

  async function waitUntilReady(id: string): Promise<DocumentRecord> {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const document = await api<DocumentRecord>(`/documents/${id}`);
      if (document.status === "ready") {
        setStatusNote("Notes are indexed. Writing your study set…");
        setProgress((current) => Math.max(current, 60));
        return document;
      }
      if (document.status === "failed") throw new Error(document.error || "Could not read this file");
      setStatusNote(
        document.status === "processing"
          ? "Reading pages and embedding chunks…"
          : "Waiting for Cado to pick up the file…",
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Processing is taking longer than expected. Try retry, or check back shortly.");
  }

  async function generateFromDocument(id: string) {
    setStatusNote("The model is writing explanations, flashcards, and quiz questions. This can take a minute.");
    const payload = {
      document_id: id,
      language,
      explanation_count: outputs.explanation ? (explanationMode === "full" ? 0 : counts.explanation) : 0,
      explanation_mode: outputs.explanation ? explanationMode : "count",
      mcq_count: outputs.mcq ? counts.mcq : 0,
      flashcard_count: outputs.flashcard ? counts.flashcard : 0,
      option_count: optionCount,
      focus: focus.trim() || null,
    };
    let studySet: StudySet;
    try {
      studySet = await api<StudySet>("/study-sets/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isShape = msg.toLowerCase().includes("wrong shape");
      if (!isShape) throw err;
      setStatusNote("Model hiccup — retrying once automatically…");
      await new Promise((r) => setTimeout(r, 1200));
      studySet = await api<StudySet>("/study-sets/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    setProgress(100);
    setStatusNote("Done. Opening your set…");
    router.push(outputs.explanation || outputs.flashcard ? `/learn/${studySet.id}` : `/quiz/${studySet.id}`);
  }

  async function generate() {
    if (!file) return setError("Choose a PDF, photo, TXT, or PPTX file first.");
    if (!formats.some((format) => outputs[format.key] && (format.key === "explanation" && explanationMode === "full" || counts[format.key] > 0))) {
      return setError("Choose at least one study format and how many items you want.");
    }
    setError("");
    setElapsed(0);
    setProgress(6);
    setStatusNote("Starting upload…");
    try {
      setStage("uploading");
      uploadError.current = "";
      const uploaded = await startUpload([file]);
      const first = uploaded?.[0];
      const result = first?.serverData;
      const fileUrl = result?.url || first?.ufsUrl || first?.url;
      const fileKey = result?.key || first?.key;
      const mimeType = mimeFor(file) || result?.type || first?.type;
      if (!fileUrl || !fileKey) {
        throw new Error(
          uploadError.current ||
            "Upload did not complete. If you used npm start on this machine, restart the app after this fix so UploadThing can finish the handshake.",
        );
      }
      const document = await api<DocumentRecord>("/documents/upload-complete", {
        method: "POST",
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ""),
          file_url: fileUrl,
          file_key: fileKey,
          mime_type: mimeType,
          language,
        }),
      });
      setDocumentId(document.id);
      setStage("reading");
      setStatusNote("File received. Extracting text…");
      await waitUntilReady(document.id);
      setStage("generating");
      await generateFromDocument(document.id);
    } catch (reason) {
      fail(reason);
    }
  }

  async function retry() {
    if (!documentId) return;
    setError("");
    setElapsed(0);
    setProgress(28);
    try {
      setStage("reading");
      setStatusNote("Retrying this file…");
      const document = await api<DocumentRecord>(`/documents/${documentId}/retry`, { method: "POST" });
      if (document.status === "ready") {
        setStage("generating");
        await generateFromDocument(documentId);
        return;
      }
      await waitUntilReady(documentId);
      setStage("generating");
      await generateFromDocument(documentId);
    } catch (reason) {
      fail(reason);
    }
  }

  const step = !file ? 0 : stage === "idle" && !error ? 1 : 2;
  const activeIndex = stageIndex(stage);
  const currentCopy =
    pipeline[Math.max(0, activeIndex)]?.copy ??
    (error ? "Fix the issue below, then retry." : "Choose a file and tap generate.");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Upload studio"
        title="Turn notes into a session."
        subtitle="Three steps: drop a file, pick what Cado should make, then generate."
      />
      <Steps current={step} items={["Add notes", "Choose outputs", "Generate"]} />

      {(working || error) && (
        <section className="card space-y-4 p-5 md:p-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="kicker">Progress</p>
              <p className="mt-1 font-extrabold">{error ? "Something went wrong" : currentCopy}</p>
              <p className="muted mt-1 text-sm">{statusNote || (error ? error : "Cado is working.")}</p>
            </div>
            <p className="muted text-sm font-bold">{elapsed}s</p>
          </div>
          <ProgressBar value={error ? progress : progress} label={error ? "Stopped" : `${progress}%`} />
          <ol className="grid gap-2 sm:grid-cols-3">
            {pipeline.map((item, index) => {
              const done = !error && (activeIndex > index || (stage === "generating" && index < 2));
              const now = !error && item.id === stage;
              return (
                <li key={item.id} className={`rounded-xl p-3 ${now ? "bg-[var(--surface-2)]" : "soft"}`}>
                  <p className="text-xs font-extrabold uppercase tracking-widest">
                    {done ? "Done" : now ? "Now" : "Next"}
                  </p>
                  <p className="mt-1 font-bold">{item.label}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <section className="card p-6 md:p-8">
          <p className="kicker mb-4">Step 1</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            className={`grid min-h-80 w-full place-items-center rounded-2xl border border-dashed p-8 ${dragging ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))]" : "border-[var(--border)] bg-[var(--surface-2)]"}`}
          >
            {file ? (
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--primary)]">
                  {fileKind(file) === "image" ? <Icon icon={Image01Icon} size={28} /> : <Icon icon={File01Icon} size={28} />}
                </span>
                <p className="mt-4 max-w-xs truncate font-semibold">{file.name}</p>
                <p className="muted mt-1 text-sm">{(file.size / 1024 / 1024).toFixed(1)} MB · Ready</p>
              </div>
            ) : (
              <div className="text-center">
                <CadoBuddy size={120} message="" />
                <p className="font-display mt-3 text-xl font-semibold">Drop your notes</p>
                <p className="muted mt-2 text-sm">PDF, PPTX, TXT, JPG, PNG, or WEBP · up to 16 MB</p>
                <span className="btn-secondary mt-5 py-2 text-sm">Browse files</span>
              </div>
            )}
          </button>
          <input ref={input} hidden type="file" accept={ACCEPT} onChange={(event) => choose(event.target.files?.[0])} />
          {file && !working && <button onClick={() => setFile(null)} className="muted mt-3 flex items-center gap-1 text-sm"><Icon icon={Cancel01Icon} size={15} /> Remove file</button>}
        </section>

        <section className="card space-y-6 p-6 md:p-8">
          <p className="kicker">Step 2</p>
          <label className="block text-sm font-semibold">Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="field mt-2" disabled={working}>
              <option>English</option><option>Spanish</option><option>French</option><option>Hindi</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Which part?
            <input
              value={focus}
              disabled={working}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="Whole notes, or type a topic (e.g. photosynthesis, chapter 4)"
              className="field mt-2"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">How many of each</legend>
            <div className="mt-4 space-y-3">
              {formats.map((format) => (
                <div
                  key={format.key}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
                >
                  <input
                    id={`output-${format.key}`}
                    type="checkbox"
                    checked={outputs[format.key]}
                    disabled={working}
                    onChange={() => setOutputs({ ...outputs, [format.key]: !outputs[format.key] })}
                    className="size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <label htmlFor={`output-${format.key}`} className="min-w-0 cursor-pointer">
                    <span className="block font-semibold leading-snug">{format.label}</span>
                    <span className="muted mt-0.5 block text-xs leading-snug">
                      {format.key === "explanation" && outputs.explanation && explanationMode === "full"
                        ? "A-Z short notes + mind map — entire doc condensed"
                        : format.hint}
                    </span>
                    {format.key === "explanation" && outputs.explanation && (
                      <span className="mode-toggle mt-2">
                        <button
                          type="button"
                          className={explanationMode === "count" ? "is-on" : ""}
                          disabled={working}
                          onClick={() => setExplanationMode("count")}
                        >
                          Count
                        </button>
                        <button
                          type="button"
                          className={explanationMode === "full" ? "is-on" : ""}
                          disabled={working}
                          onClick={() => setExplanationMode("full")}
                        >
                          Full
                        </button>
                      </span>
                    )}
                    {format.key === "explanation" && outputs.explanation && explanationMode === "full" && (
                      <span className="mt-1.5 block text-[11px] leading-snug font-medium text-[var(--primary)]">
                        5–10 short notes (2–4 lines each) + interactive graph · Auto count
                      </span>
                    )}
                  </label>
                  {format.key === "explanation" && explanationMode === "full" ? (
                    <span className="muted text-xs font-bold whitespace-nowrap px-1">Auto · A-Z</span>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={format.max}
                      value={counts[format.key]}
                      disabled={working || !outputs[format.key]}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setCounts({
                          ...counts,
                          [format.key]: Number.isFinite(next)
                            ? Math.min(format.max, Math.max(1, Math.round(next)))
                            : 1,
                        });
                      }}
                      className="count-field"
                      aria-label={`Number of ${format.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </fieldset>
          {outputs.mcq && counts.mcq > 40 && (
            <p className="muted text-xs">Large quizzes can take several minutes to write.</p>
          )}
          {outputs.mcq && (
            <label className="block text-sm font-semibold">Answers per quiz question
              <select value={optionCount} disabled={working} onChange={(event) => setOptionCount(Number(event.target.value))} className="field mt-2">
                <option value={4}>4 options</option>
                <option value={5}>5 options</option>
              </select>
            </label>
          )}
          {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
          {error && documentId && <button onClick={retry} className="btn-secondary w-full">Retry this file</button>}
          <button disabled={working} onClick={generate} className="btn-primary w-full disabled:opacity-60">
            {working ? <Icon icon={Loading03Icon} className="animate-spin" size={18} /> : <Icon icon={SparklesIcon} size={18} />}
            {working && stage === "uploading" ? "Uploading…" : working && stage === "reading" ? "Reading notes…" : working && stage === "generating" ? "Building set…" : "Generate study set"}
          </button>
          {working && <p className="muted text-center text-xs">Stay on this page. Progress updates as Cado works.</p>}
        </section>
      </div>
    </div>
  );
}
