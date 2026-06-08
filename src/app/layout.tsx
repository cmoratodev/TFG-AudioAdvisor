import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Audio Advisor",
    template: "%s · Audio Advisor",
  },
  description:
    "Plataforma de feedback técnico para productores musicales — sube tu pista, recibe comentarios anclados al segundo y desbloquea rangos.",
  applicationName: "Audio Advisor",
  authors: [{ name: "Carlos Morato" }],
  keywords: ["audio", "feedback", "música", "productor", "mezcla", "mastering", "TFG"],
  openGraph: {
    type: "website",
    siteName: "Audio Advisor",
    title: "Audio Advisor — Feedback técnico de audio sin concesiones",
    description: "Sube tu pista, recibe comentarios anclados al segundo y desbloquea rangos.",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "Audio Advisor — Feedback técnico de audio sin concesiones",
    description: "Sube tu pista, recibe comentarios anclados al segundo y desbloquea rangos.",
  },
};

import { Navbar } from "@/components/layout/Navbar";
import { AudioPlayer } from "@/components/layout/AudioPlayer";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { VerifyEmailBanner } from "@/components/layout/VerifyEmailBanner";
import { ToastViewport } from "@/components/layout/ToastViewport";
import { AmbientBackground } from "@/components/layout/AmbientBackground";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#fbfaff] text-zinc-950 selection:bg-zinc-200">
        <SessionProvider>
          <a href="#main-content" className="skip-to-main">
            Saltar al contenido principal
          </a>
          <AmbientBackground />
          <Navbar />
          <VerifyEmailBanner />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <AudioPlayer />
          <ToastViewport />
        </SessionProvider>
      </body>
    </html>
  );
}
