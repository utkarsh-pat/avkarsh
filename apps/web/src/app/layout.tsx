import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { PwaRegistration } from "@/components/pwa-registration";
import { ThemeToggle } from "@/components/theme-toggle";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Avkarsh", template: "%s | Avkarsh" },
  description: "Secure hotel operations for every property and shift.",
  applicationName: "Avkarsh",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">{`try{const saved=localStorage.getItem('avkarsh-theme');const theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch{document.documentElement.dataset.theme='light'}`}</Script>
        {children}
        <ThemeToggle />
        <PwaRegistration />
      </body>
    </html>
  );
}
