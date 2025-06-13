
'use client';
import type { FC } from 'react';
import ChatInterface from '@/components/chat-interface';

const HomePage: FC = () => {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-primary">
            Genkit AI Chat
          </h1>
        </header>
        <ChatInterface />
      </div>
    </main>
  );
};

export default HomePage;
