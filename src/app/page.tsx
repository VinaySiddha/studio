// src/app/page.tsx
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import ProfilePopup from '@/components/profile-popup';
import ChatInterface from '@/components/chat-interface';
import { Button } from '@/components/ui/button'; // For potential future use
import { Separator } from '@/components/ui/separator'; // For potential future use
import { Info } from 'lucide-react';

const HomePage: FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client-side
    setIsClient(true);
    const storedKey = localStorage.getItem('geminiUserApiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleApiKeyUpdate = (newKey: string | null) => {
    setApiKey(newKey);
  };

  if (!isClient) {
    // Render nothing or a loading indicator on the server or during first client render
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
            <div className="animate-pulse text-xl">Loading Chat Interface...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-slate-900 to-zinc-900 text-foreground p-4 font-sans">
      <header className="absolute top-4 right-4 z-10">
        <ProfilePopup onApiKeyUpdate={handleApiKeyUpdate} initialApiKey={apiKey} />
      </header>

      <div className="flex flex-col items-center mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary font-headline mb-2 tracking-tight">
          AI Powered Chatbot
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Switch between general chat with Gemini and contextual chat about your documents.
        </p>
      </div>
      
      {!apiKey && (
        <div className="w-[400px] mb-4 p-4 rounded-lg bg-yellow-900/40 border border-yellow-700 text-yellow-200 text-sm flex items-center gap-3">
          <Info size={24} className="shrink-0 text-yellow-400" />
          <span>Please set your Gemini API Key using the profile icon (top-right) to enable chat functionality.</span>
        </div>
      )}

      <ChatInterface initialApiKey={apiKey} />
      
      <footer className="mt-12 text-center text-xs text-muted-foreground/70 w-full max-w-xl">
        <p>
          Ensure your <code className="bg-muted/50 text-foreground px-1 py-0.5 rounded mx-0.5">GOOGLE_API_KEY</code> environment variable is set on the server for Genkit functionality.
          The API key entered via the profile icon is stored locally in your browser for this session's UI feedback.
        </p>
        <p className="mt-1">
          Chatbot Prototype v1.0.0
        </p>
      </footer>
    </div>
  );
};

export default HomePage;
