"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { scrollToSection } from "@/lib/lenis-scroll"

const navItems = [
  { label: "Product", id: "product" },
  { label: "Use cases", id: "use-cases" },
  { label: "Features", id: "command-center" },
  { label: "Study flow", id: "agents" },
  { label: "Pricing", id: "pricing" },
  { label: "FAQ", id: "faq" },
]

export function SideNav() {
  const pathname = usePathname()
  const [active, setActive] = useState<string>("product")

  useEffect(() => {
    if (pathname !== "/") return

    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) {
          setActive(visible[0].target.id)
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [pathname])

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    scrollToSection(id, -80)
    setActive(id)
  }

  const linkClass = (isActive: boolean) =>
    isActive
      ? "rounded-md bg-neutral-100 px-3 py-1.5 text-black font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
      : "rounded-md px-3 py-1.5 text-black/50 font-normal hover:text-black hover:bg-neutral-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"

  return (
    <div className="sticky top-24 flex flex-col gap-10">
      <Link
        href="/"
        aria-label="Cado AI — back to home"
        className="relative size-32 block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-4"
      >
        <Image src="/sunflower.jpg" alt="" fill className="object-contain" sizes="128px" priority />
      </Link>
      <nav aria-label="Page sections" className="flex flex-col gap-0.5 text-[13px]">
        {navItems.map((item) => {
          const isActive = pathname === "/" && active === item.id
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(event) => handleClick(event, item.id)}
              aria-current={isActive ? "true" : undefined}
              className={linkClass(isActive)}
            >
              {item.label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
