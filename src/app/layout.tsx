import type { Metadata } from "next";
import { Fira_Code } from 'next/font/google'; // 1. Import Fira_Code
import "./globals.css";

// 2. Configure the font
const firaCode = Fira_Code({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fira-code', // Useful if you want to use it via CSS variables
});

export const metadata: Metadata = {
  title: "RevChat",
  description: "Secure terminal-based communication protocol", // Thematic update
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* 3. Apply the class to the body and ensure antialiasing */}
      <body className={`${firaCode.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}