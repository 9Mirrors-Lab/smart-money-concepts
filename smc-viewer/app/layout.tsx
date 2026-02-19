import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavWrapper } from "@/components/nav-wrapper";
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
  title: "SMC Animation Viewer",
  description: "Interactive Smart Money Concepts animation viewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <NavWrapper>{children}</NavWrapper>
      </body>
    </html>
  );
}
