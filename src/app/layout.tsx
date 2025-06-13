import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
// Removed Script import for Mermaid as it will be handled in AppContent or page if needed specifically for mindmaps.

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Local AI Engineering Tutor',
  description: 'Interface for interacting with local AI models for engineering education.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground overflow-hidden`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
