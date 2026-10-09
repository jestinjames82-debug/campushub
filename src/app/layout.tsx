import type { Metadata, Viewport } from "next";
import "./globals.css";
import Pwa from "@/components/pwa";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: "CampusHub | Your semester, together",
    template: "%s | CampusHub",
  },
  description:
    "A calm academic workspace for students at colleges across India. Plan classes, track progress, and keep your study life in one place.",
  applicationName: "CampusHub",
  generator: "CampusHub",
  keywords: ["student planner", "college workspace", "academic organiser", "India"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#22314f",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <Pwa />
        {children}
      </body>
    </html>
  );
}
