import type { Metadata } from "next";
import { Sora, Space_Grotesk } from "next/font/google";
import "@/app/globals.css";

const fontHeading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading"
});

const fontBody = Sora({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "SatyaVault | GovTech Digital Forensics",
  description: "Immutable chain-of-custody for digital evidence"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontHeading.variable} ${fontBody.variable} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
