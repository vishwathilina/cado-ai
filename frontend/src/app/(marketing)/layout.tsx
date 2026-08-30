import { Fraunces, Geist } from "next/font/google";
import "./landing.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${geist.variable} ${fraunces.variable} font-sans bg-white text-[#0A0A0A] min-h-screen`}>
      {children}
    </div>
  );
}
