"use client";

import { Bookmark02Icon, Loading03Icon, VolumeHighIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { api } from "@/lib/api";

type Definition = { word: string; definition: string; pronunciation?: string; example?: string };

export function VocabularyText({ text, enabled }: { text: string; enabled: boolean }) {
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [loading, setLoading] = useState("");

  async function define(word: string) {
    setLoading(word);
    try {
      setDefinition(await api<Definition>("/vocabulary", {
        method: "POST",
        body: JSON.stringify({ word: word.replace(/[^\p{L}-]/gu, ""), context: text }),
      }));
    } finally { setLoading(""); }
  }

  return (
    <span className="relative">
      {text.split(/(\s+)/).map((part, index) => {
        const plain = part.replace(/[^\p{L}-]/gu, "");
        const complex = enabled && plain.length >= 9;
        return complex ? (
          <button key={`${part}-${index}`} onClick={() => define(plain)} className="rounded bg-indigo-500/10 text-[var(--primary)] underline decoration-dotted underline-offset-4">
            {part}{loading === plain && <Icon icon={Loading03Icon} className="ml-1 inline animate-spin" size={12} />}
          </button>
        ) : <span key={`${part}-${index}`}>{part}</span>;
      })}
      {definition && (
        <span className="card absolute left-0 top-full z-20 mt-3 block w-72 p-4 text-left shadow-2xl">
          <span className="flex items-center gap-2 font-extrabold"><Icon icon={Bookmark02Icon} size={16} className="text-[var(--primary)]" />{definition.word}</span>
          {definition.pronunciation && <span className="muted mt-1 flex items-center gap-1 text-xs"><Icon icon={VolumeHighIcon} size={12} />{definition.pronunciation}</span>}
          <span className="mt-3 block text-sm leading-6">{definition.definition}</span>
          {definition.example && <span className="muted mt-2 block text-xs italic">“{definition.example}”</span>}
          <button className="mt-3 text-xs font-bold text-[var(--primary)]" onClick={() => setDefinition(null)}>Close</button>
        </span>
      )}
    </span>
  );
}
