import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Providers } from "../../components/Providers";
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
  title: "MyBoard",
  description: "Canvas board for drawings, text, and images.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyBoard",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-maskable-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-maskable-512.png", sizes: "512x512", type: "image/png" },
      { url: "/app-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", function () {
                navigator.serviceWorker.register("/sw.js").catch(function (err) {
                  console.warn("Service worker registration failed:", err);
                });
              });
            }
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
