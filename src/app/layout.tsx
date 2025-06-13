
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientToaster from '@/components/client-toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Genkit AI Chatbot',
  description: 'A simple chatbot interface using Genkit and Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <ClientToaster />
      </body>
    </html>
  );
}
