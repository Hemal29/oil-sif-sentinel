import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import ParticleCanvas from "@/components/ui/ParticleCanvas";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OIL SIF Sentinel — Safety Intelligence Platform",
    template: "%s · OIL SIF Sentinel",
  },
  description: "Enterprise HSE platform to detect SIF precursors in unsafe-act, unsafe-condition and near-miss reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        {/* Industrial particle background — fixed, non-interactive */}
        <ParticleCanvas />
        {/* Foreground content above canvas */}
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
