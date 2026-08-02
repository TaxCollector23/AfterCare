import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { TopNav } from "@/components/nav/top-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AfterCare — Your Recovery Dashboard",
  description: "A clear, calm guide to your recovery at home.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem('aftercare:settings');
    if (!raw) return;
    var s = JSON.parse(raw);
    var root = document.documentElement;
    if (s.theme && s.theme !== 'system') root.setAttribute('data-theme', s.theme);
    if (s.contrast === 'high') root.setAttribute('data-contrast', 'high');
    if (s.textSize === 'large') root.setAttribute('data-text-size', 'large');
    if (s.motion === 'reduced') root.setAttribute('data-motion', 'reduced');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-(--color-bg) text-(--color-text-primary)">
        <SettingsProvider>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <TopNav />
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </SettingsProvider>
      </body>
    </html>
  );
}
