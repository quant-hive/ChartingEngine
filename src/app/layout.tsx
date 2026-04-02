import type { Metadata } from "next";
import { Inter, Tiro_Bangla, Instrument_Serif, Old_Standard_TT, EB_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const tiroBangla = Tiro_Bangla({
  variable: "--font-tiro-bangla",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const oldStandardTT = Old_Standard_TT({
  variable: "--font-old-standard",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flash Plot — Charting Engine Playground",
  description: "Interactive charting engine with MCP integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${tiroBangla.variable} ${instrumentSerif.variable} ${oldStandardTT.variable} ${ebGaramond.variable} antialiased`}>{children}</body>
    </html>
  );
}
