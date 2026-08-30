"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isSamePageHashLink, scrollToHref, scrollToSection } from "@/lib/lenis-scroll";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { useMarketingSmoothScroll } from "@/components/landing/use-marketing-smooth-scroll";

export function MarketingSmoothScroll() {
  const pathname = usePathname();

  useMarketingSmoothScroll();

  useEffect(() => {
    if (pathname !== "/") return;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href");
      if (!href || !isSamePageHashLink(href, pathname)) return;

      event.preventDefault();
      scrollToHref(href);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    const hash = window.location.hash;
    if (!hash) return;

    const id = hash.slice(1);
    const timer = window.setTimeout(() => scrollToSection(id), 120);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <ScrollProgress />;
}
