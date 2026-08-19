import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "CambridgeYLE", description: "A focused English practice workspace." };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
