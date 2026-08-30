import type { Metadata, Viewport } from 'next'
import { Geist, Fraunces } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
})

const SITE_URL = 'https://cofounder.app'
const SITE_NAME = 'Cofounder'
const TITLE = 'Cofounder — Software that tends itself'
const DESCRIPTION =
  'Cofounder is a natural-language automation tool for knowledge workers. Describe what you want in plain English and Cofounder writes, runs, and maintains the workflow across Linear, Notion, Slack, and Gmail — no triggers to configure, no agents to babysit.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s — Cofounder',
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: 'v0.app',
  keywords: [
    'natural language automation',
    'AI workflow automation',
    'Linear automation',
    'Notion automation',
    'Slack automation',
    'Gmail automation',
    'AI agents for work',
    'no-code automation',
    'workflow AI',
    'Zapier alternative',
    'productivity AI',
    'cofounder',
  ],
  authors: [{ name: 'Cofounder' }],
  creator: 'Cofounder',
  publisher: 'Cofounder',
  category: 'Productivity',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/pixel-automation.png',
        width: 1200,
        height: 1200,
        alt: 'Cofounder — pixel-art illustration of a workstation connecting email, calendar, gears, and automation icons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/pixel-automation.png'],
    creator: '@cofounder',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/sunflower.jpg',
    apple: '/sunflower.jpg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/sunflower.jpg`,
      description:
        'Cofounder is a natural-language automation tool that plants, runs, and maintains workflows across the tools knowledge workers already use.',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      operatingSystem: 'Web, macOS, Windows',
      applicationCategory: 'BusinessApplication',
      url: SITE_URL,
      description: DESCRIPTION,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Natural-language automation authoring',
        'Native integrations with Linear, Notion, Slack, and Gmail',
        'Persistent agents that monitor and act',
        'Daily calendar and inbox briefings',
        'Document, spreadsheet, and image generation',
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Cofounder?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Cofounder is a natural-language automation tool for knowledge workers. You describe what you want in plain English and Cofounder writes the automation, runs it across your existing tools, and keeps it maintained — no triggers to configure, no agents to babysit.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which tools does Cofounder integrate with?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Cofounder plugs into the software knowledge teams already use, including Linear, Notion, Slack, and Gmail. Automations are written once in plain English and executed natively across those tools.',
          },
        },
        {
          '@type': 'Question',
          name: 'How is Cofounder different from Zapier or n8n?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Zapier and n8n require you to manually define triggers, actions, and field mappings. Cofounder takes one English sentence — for example, “Every Monday, email me a digest of new posts from these tech blogs” — and produces, schedules, and maintains the automation for you.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do I need to be technical to use Cofounder?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. Cofounder is designed for founders, operators, and small teams. If you can describe the outcome you want, Cofounder handles the steps, the tools, and the schedule.',
          },
        },
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} bg-white`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-[#0A0A0A]">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
