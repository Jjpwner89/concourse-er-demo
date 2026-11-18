import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif-doc", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Concourse · Employee Relations",
  description: "Concourse Employee Relations case management. Prototype for San Bernardino County RFP HRD127-HR-6548 (synthetic data).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
