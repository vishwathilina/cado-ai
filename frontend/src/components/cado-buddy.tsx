"use client";

import Image from "next/image";

type Pose = "auto" | "hiker" | "astronaut";

const copy: Record<"hiker" | "astronaut", string> = {
  hiker: "Ready when you are. Let’s hike through these notes.",
  astronaut: "Night-shift mode. I’ll float the hard parts with you.",
};

function BuddyImage({
  src,
  size,
  className,
  priority,
}: {
  src: string;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={`buddy-art ${className ?? ""}`}
      style={{ width: "auto", height: "auto" }}
      priority={priority}
    />
  );
}

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
  const caption = message === "" ? null : (message ?? copy[pose === "astronaut" ? "astronaut" : "hiker"]);

  return (
    <figure className={`buddy ${className}`}>
      {pose === "auto" ? (
        <span className="buddy-frames" role="img" aria-label="Cado, the avocado study buddy">
          <BuddyImage src="/cado-hiker.webp" size={size} className="buddy-art-light" priority={size >= 180} />
          <BuddyImage src="/cado-astronaut.webp" size={size} className="buddy-art-dark" priority={size >= 180} />
        </span>
      ) : (
        <span role="img" aria-label="Cado, the avocado study buddy">
          <BuddyImage
            src={pose === "astronaut" ? "/cado-astronaut.png" : "/cado-hiker.png"}
            size={size}
            priority={size >= 180}
          />
        </span>
      )}
      {caption && <figcaption className="buddy-bubble">{caption}</figcaption>}
    </figure>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 36 : 40;
  return (
    <span className="brand-mark">
      <Image
        src="/logo2.jpg"
        alt={compact ? "Cado AI" : ""}
        width={size}
        height={size}
        className="brand-logo"
        style={{ width: size, height: size }}
        priority
      />
      {!compact && <span>Cado AI</span>}
    </span>
  );
}
