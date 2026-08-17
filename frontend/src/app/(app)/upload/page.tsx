"use client";

import {
  Cancel01Icon,
  File01Icon,
  Image01Icon,
  Loading03Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { DragEvent, useRef, useState } from "react";
import { CadoBuddy } from "@/components/cado-buddy";
import { Icon } from "@/components/icon";
import { PageHeader, Steps } from "@/components/ui";
import { api, DocumentRecord, StudySet } from "@/lib/api";
import { useUploadThing } from "@/lib/uploadthing";

const formats = [
  ["explanation", "Short explanations", "Read the ideas first"],
  ["mcq", "Interactive quiz", "4 or 5 clickable answers"],
  ["flashcard", "Flashcards", "Flip and review"],
] as const;

export default function UploadPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [language, setLanguage] = useState("English");
  const [outputs, setOutputs] = useState({ explanation: true, mcq: true, flashcard: true });
  const [optionCount, setOptionCount] = useState(4);
  const [count, setCount] = useState(5);
  const [stage, setStage] = useState<"idle" | "uploading" | "reading" | "generating">("idle");
  const [error, setError] = useState("");
  const [documentId, setDocumentId] = useState("");
  const { startUpload } = useUploadThing("studyMaterial");

  function choose(selected?: File) {
    if (!selected) return;
    if (selected.size > 16 * 1024 * 1024) return setError("Please choose a file under 16 MB.");
    setFile(selected);
    setError("");
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  async function waitUntilReady(id: string): Promise<DocumentRecord> {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const document = await api<DocumentRecord>(`/documents/${id}`);
      if (document.status === "ready") return document;
      if (document.status === "failed") throw new Error(document.error || "Could not read this file");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Processing is taking longer than expected. Try retry, or check back shortly.");
  }

  async function generateFromDocument(id: string) {
    const studySet = await api<StudySet>("/study-sets/generate", {
      method: "POST",
      body: JSON.stringify({
        document_id: id,
        language,
        explanation_count: outputs.explanation ? Math.min(count, 5) : 0,
        mcq_count: outputs.mcq ? count : 0,
        flashcard_count: outputs.flashcard ? count : 0,
        option_count: optionCount,
      }),
    });
    router.push(outputs.explanation || outputs.flashcard ? `/learn/${studySet.id}` : `/quiz/${studySet.id}`);
  }

  async function generate() {
    if (!file) return setError("Choose a PDF or photo first.");
    if (!Object.values(outputs).some(Boolean)) return setError("Choose at least one study format.");
    setError("");
    try {
      setStage("uploading");
      const uploaded = await startUpload([file]);
      const result = uploaded?.[0]?.serverData;
      if (!result) throw new Error("Upload did not complete");
      const document = await api<DocumentRecord>("/documents/upload-complete", {
        method: "POST",
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ""),
          file_url: result.url,
          file_key: result.key,
          mime_type: result.type || file.type,
          language,
        }),
      });
      setDocumentId(document.id);
      setStage("reading");
      await waitUntilReady(document.id);
      setStage("generating");
      await generateFromDocument(document.id);
    } catch (reason) {
      setStage("idle");
      setError(reason instanceof Error ? reason.message : "Generation failed");
    }
  }

  async function retry() {
    if (!documentId) return;
    setError("");
    try {
      setStage("reading");
      try {
        await api(`/documents/${documentId}/retry`, { method: "POST" });
      } catch {
        /* already ready */
      }
      await waitUntilReady(documentId);
      setStage("generating");
      await generateFromDocument(documentId);
    } catch (reason) {
      setStage("idle");
      setError(reason instanceof Error ? reason.message : "Retry failed");
    }
  }

  const busy = stage !== "idle";
  const step = !file ? 0 : stage === "idle" ? 1 : 2;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Upload studio"
        title="Turn notes into a session."
        subtitle="Three steps: drop a file, pick what Cado should make, then generate."
      />
      <Steps current={step} items={["Add notes", "Choose outputs", "Generate"]} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="card p-5 md:p-7">
          <p className="kicker mb-4">Step 1</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
            className={`grid min-h-72 w-full place-items-center rounded-3xl border-2 border-dashed p-6 transition ${dragging ? "border-[var(--primary)] bg-[var(--primary)]/10" : "soft"}`}
          >
            {file ? (
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  {file.type === "application/pdf" ? <Icon icon={File01Icon} size={30} /> : <Icon icon={Image01Icon} size={30} />}
                </span>
                <p className="mt-4 max-w-xs truncate font-extrabold">{file.name}</p>
                <p className="muted mt-1 text-sm">{(file.size / 1024 / 1024).toFixed(1)} MB · Ready</p>
              </div>
            ) : (
              <div>
                <CadoBuddy size={130} message="" />
                <p className="mt-3 text-lg font-extrabold">Drop a PDF or photo</p>
                <p className="muted mt-2 text-sm">JPG, PNG, WEBP or PDF · up to 16 MB</p>
                <span className="mt-5 inline-block rounded-xl border bg-[var(--surface)] px-4 py-2 text-sm font-bold">Browse files</span>
              </div>
            )}
          </button>
          <input ref={input} hidden type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0])} />
          {file && <button onClick={() => setFile(null)} className="muted mt-3 flex items-center gap-1 text-sm"><Icon icon={Cancel01Icon} size={15} /> Remove file</button>}
        </section>

        <section className="card space-y-5 p-6">
          <p className="kicker">Step 2</p>
          <label className="block text-sm font-bold">Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="field mt-2">
              <option>English</option><option>Spanish</option><option>French</option><option>Hindi</option>
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-bold">Cado should make</legend>
            <div className="mt-3 space-y-2">
              {formats.map(([key, label, hint]) => (
                <label key={key} className="soft flex cursor-pointer items-start gap-3 rounded-xl p-3">
                  <input type="checkbox" checked={outputs[key]} onChange={() => setOutputs({ ...outputs, [key]: !outputs[key] })} className="mt-1 size-4 accent-[var(--primary)]" />
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="muted text-xs">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">Items each
              <select value={count} onChange={(event) => setCount(Number(event.target.value))} className="field mt-2"><option>4</option><option>5</option><option>10</option></select>
            </label>
            <label className="text-sm font-bold">Quiz options
              <select value={optionCount} onChange={(event) => setOptionCount(Number(event.target.value))} className="field mt-2"><option>4</option><option>5</option></select>
            </label>
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-[var(--danger)]">{error}</p>}
          {error && documentId && <button onClick={retry} className="btn-secondary w-full">Retry this file</button>}
          <button disabled={busy} onClick={generate} className="btn-primary w-full disabled:opacity-60">
            {busy ? <Icon icon={Loading03Icon} className="animate-spin" size={18} /> : <Icon icon={SparklesIcon} size={18} />}
            {stage === "uploading" ? "Uploading…" : stage === "reading" ? "Reading notes…" : stage === "generating" ? "Building set…" : "Generate study set"}
          </button>
          {busy && <p className="muted text-center text-xs">Stay on this page. Cado is working through your notes.</p>}
        </section>
      </div>
    </div>
  );
}
