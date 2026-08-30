"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { bindLenisScroll, MARKETING_LENIS_OPTIONS } from "@/lib/lenis-scroll";

export function useMarketingSmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    return bindLenisScroll(MARKETING_LENIS_OPTIONS, true);
  }, [pathname]);
}
