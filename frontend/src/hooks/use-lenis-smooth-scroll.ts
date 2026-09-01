"use client";

import { useEffect } from "react";
import { bindLenisScroll, DEFAULT_LENIS_OPTIONS } from "@/lib/lenis-scroll";

export function useLenisSmoothScroll() {
  useEffect(() => bindLenisScroll(DEFAULT_LENIS_OPTIONS), []);
}
