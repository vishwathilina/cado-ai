import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cofounder.app"
  const now = new Date()
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/#product`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/#use-cases`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/#command-center`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/#agents`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/#faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ]
}
