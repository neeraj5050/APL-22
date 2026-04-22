import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Crowd Pulse — Live Emotional Scoreboard | IPL 2026",
  description:
    "Real-time emotional analytics platform for IPL cricket matches. Live sentiment analysis across 5 emotional pillars: Tension, Euphoria, Frustration, Disbelief, and Jubilation.",
  keywords: "IPL, cricket, sentiment analysis, emotional analytics, crowd pulse, real-time",
  authors: [{ name: "Crowd Pulse" }],
  themeColor: "#06080f",
  openGraph: {
    title: "Crowd Pulse — Live Emotional Scoreboard",
    description: "Real-time emotional analytics for IPL cricket matches",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
