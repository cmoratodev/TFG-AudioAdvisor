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
  title: "Audio Advisor",
  description: "Plataforma de feedback técnico para productores musicales",
};

import { Navbar } from "@/components/layout/Navbar";
import { AudioPlayer } from "@/components/layout/AudioPlayer";
import { SessionProvider } from "@/components/layout/SessionProvider";

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
      <body className="flex min-h-full flex-col bg-white text-zinc-950 selection:bg-zinc-200">
        <SessionProvider>
          <Navbar />
          <main className="flex-1 pb-24">
            {children}
          </main>
          <AudioPlayer />
        </SessionProvider>
      </body>
    </html>
  );
}
