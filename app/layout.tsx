import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "What Was the Weather? | Historical Weather Lookup by Date",
  description: "Look up historical weather for any date going back 20+ years. Find out the temperature, precipitation, and weather conditions for any past date in any US location.",
  keywords: ["historical weather", "weather history", "past weather", "weather lookup", "weather by date"],
  openGraph: {
    title: "What Was the Weather?",
    description: "Look up historical weather for any date going back 20+ years",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "What Was the Weather?",
    description: "Look up historical weather for any date going back 20+ years",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
