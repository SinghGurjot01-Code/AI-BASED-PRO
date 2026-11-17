import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "META VIEW — Image Metadata Studio",
  description: "Inspect, edit and enrich image metadata with AI.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
