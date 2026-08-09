import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { LogOut } from "lucide-react";
import "./globals.css";
import { isAuthenticated } from "@/lib/auth";

const inter = localFont({
  src: [
    { path: "../assets/fonts/regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/bold.ttf", weight: "700", style: "normal" },
    { path: "../assets/fonts/black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ContentPilot — ReclutMatch",
  description: "Generación y aprobación de contenido para redes sociales",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authed = await isAuthenticated();

  return (
    <html lang="es" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-panel/60 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-black tracking-tight">
              Content<span className="text-gold">Pilot</span>
            </Link>
            {authed && (
              <nav className="flex items-center gap-6 text-sm text-neutral-300">
                <Link href="/" className="hover:text-gold-light transition-colors">Cola</Link>
                <Link href="/businesses" className="hover:text-gold-light transition-colors">Negocios</Link>
                <Link href="/settings" className="hover:text-gold-light transition-colors">Integraciones</Link>
                <a
                  href="/api/auth/logout"
                  className="flex items-center gap-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                >
                  <LogOut size={15} strokeWidth={2} />
                  Salir
                </a>
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-6 py-8 flex-1">{children}</main>
        <footer className="border-t border-line py-4 text-center text-xs text-neutral-500">
          ContentPilot · ReclutMatch
        </footer>
      </body>
    </html>
  );
}
