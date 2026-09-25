import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OIL SIF Sentinel — Worker Portal",
  description: "Worker Portal for submitting and tracking safety reports",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
