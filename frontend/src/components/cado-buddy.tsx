"use client";

import { useTheme } from "next-themes";
import Image from "next/image";

type Pose = "auto" | "hiker" | "astronaut";

const copy: Record<string, string> = {
  hiker: "Ready when you are. Let’s hike through these notes.",
  astronaut: "Night-shift mode. I’ll float the hard parts with you.",
};

export function CadoBuddy({
  pose = "auto",
  message,
  size = 220,
  className = "",
}: {
  pose?: Pose;
  message?: string;
  size?: number;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const variant = pose === "auto" ? (resolvedTheme === "dark" ? "astronaut" : "hiker") : pose;
  const src = variant === "astronaut" ? "/cado-astronaut.png" : "/cado-hiker.png";

  return (
    <figure className={`buddy ${className}`}>
      <Image
        src={src}
        alt="Cado, the avocado study buddy"
        width={size}
        height={size}
        className="buddy-art"
        priority={size >= 180}
      />
      {message !== "" && (
        <figcaption className="buddy-bubble">
          {message ?? copy[variant]}
        </figcaption>
      )}
    </figure>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark">
      <span className="brand-pit" aria-hidden>
        <span className="brand-face" />
      </span>
      {!compact && <span>Cado AI</span>}
    </span>
  );
}
