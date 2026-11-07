import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "MicroChef",
  description: "Adatta qualsiasi ricetta al tuo forno a microonde, partendo dal suo manuale.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "MicroChef", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-600">
              MicroChef
            </Link>
            <div className="flex gap-4 text-sm font-medium">
              <Link href="/forni" className="hover:text-brand-600">
                I miei forni
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
