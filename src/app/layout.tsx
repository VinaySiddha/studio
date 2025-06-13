
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientToaster from '@/components/client-toaster'; // Changed import

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
        <ClientToaster /> {/* Use the client-side wrapper */}
      </body>
    </html>
  );
}
