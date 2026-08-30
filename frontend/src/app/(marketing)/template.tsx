"use client";

import { MarketingSmoothScroll } from "@/components/landing/marketing-smooth-scroll";
import { PageTransition } from "@/components/page-transition";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <MarketingSmoothScroll />
      {children}
    </PageTransition>
  );
}
