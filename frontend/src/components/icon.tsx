import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type IconProp = ComponentProps<typeof HugeiconsIcon>["icon"];

export function Icon({
  icon,
  size = 20,
  className,
}: {
  icon: IconProp;
  size?: number;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color="currentColor"
      strokeWidth={1.75}
      className={className}
    />
  );
}
