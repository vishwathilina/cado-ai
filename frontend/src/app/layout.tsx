import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { themeInitScript } from "@/lib/theme-script";
import "./globals.css";

const inter = localFont({
  src: "../../public/Inter/Inter-VariableFont_opsz,wght.ttf",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Cado AI",
    template: "%s · Cado AI",
  },
  description: "Turn notes into clear explanations, flashcards, quizzes, and a personal study plan.",
  icons: {
    icon: [{ url: "/logo2.jpg", type: "image/jpeg" }],
    apple: "/logo2.jpg",
    shortcut: "/logo2.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.className} min-h-full`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
