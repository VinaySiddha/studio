// src/app/page.tsx
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import ChatInterface from '@/components/chat-interface';
import { Info } from 'lucide-react';


const HomePage: FC = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <div className="animate-pulse text-xl">Loading Chat Interface...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 font-sans">
      <div className="flex flex-col items-center mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary mb-2 tracking-tight">
          Simple AI Chatbot
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Powered by Genkit and Gemini.
        </p>
      </div>
        
      <div className="mb-4 p-3 rounded-md bg-blue-900/30 border border-blue-700 text-blue-300 text-xs flex items-start gap-2 max-w-md">
          <Info size={28} className="shrink-0 mt-0.5 text-blue-400"/>
          <div>
            <strong>Important:</strong> This chatbot uses Genkit with the Google AI plugin, which relies on a 
            <code className="bg-muted/50 text-foreground px-1 py-0.5 rounded mx-0.5">GOOGLE_API_KEY</code> environment variable 
            set on the server where the Next.js application is running.
          </div>
      </div>

      <ChatInterface />
      
      <footer className="mt-12 text-center text-xs text-muted-foreground/70 w-full max-w-xl">
        <p>
          Ensure your <code className="bg-muted/50 text-foreground px-1 py-0.5 rounded mx-0.5">GOOGLE_API_KEY</code> environment variable is set on the server.
        </p>
        <p className="mt-1">
          Chatbot Prototype v0.1.0
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
