import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VibeChat",
  description: "Realtime chat, status and channels."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
