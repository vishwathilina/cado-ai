"use client";

import { useEffect } from "react";
import { bindMotionSmoothScroll } from "@/lib/motion-scroll";

export function useMotionSmoothScroll() {
  useEffect(() => bindMotionSmoothScroll(), []);
}
