// src/components/chat-interface.tsx
'use client';

import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageItem, { type Message } from '@/components/message-item';
import { SendHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ChatInterface: FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    const aiPlaceholderMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiPlaceholderMessageId, role: 'model', content: 'Thinking...', timestamp: new Date() },
    ]);

    try {
      const requestBody = {
        query,
        history: messages.filter(m => m.role === 'user' || m.role === 'model').map(m => ({role: m.role, content: m.content})),
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      setMessages((prev) => prev.filter((msg) => msg.id !== aiPlaceholderMessageId)); 

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: `Request failed: ${response.status}` }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';
      const aiMessageId = (Date.now() + 2).toString();

      setMessages((prev) => [
        ...prev,
        { id: aiMessageId, role: 'model', content: '', timestamp: new Date() },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        const sseMessages = chunk.split('\n\n').filter(Boolean);
        for (const sseMessage of sseMessages) {
          if (sseMessage.startsWith('data: ')) {
            const rawData = sseMessage.substring(6);
            try {
              const jsonData = JSON.parse(rawData);
              if (jsonData.type === 'chunk' && jsonData.content) {
                accumulatedResponse += jsonData.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId ? { ...msg, content: accumulatedResponse } : msg
                  )
                );
              } else if (jsonData.type === 'final') {
                if (jsonData.answer && accumulatedResponse !== jsonData.answer) {
                   setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId ? { ...msg, content: jsonData.answer } : msg
                    )
                  );
                }
              } else if (jsonData.type === 'error') {
                throw new Error(jsonData.error || 'Stream error from server');
              }
            } catch (parseError) {
              console.warn('Error parsing SSE JSON:', parseError, "Raw data:", rawData);
              if (typeof rawData === 'string' && !rawData.startsWith('{')) {
                 accumulatedResponse += rawData; 
                 setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId ? { ...msg, content: accumulatedResponse } : msg
                    )
                 );
              }
            }
          } else if (sseMessage.trim()) { 
            accumulatedResponse += sseMessage;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content: accumulatedResponse } : msg
              )
            );
          }
        }
      }
      if (!accumulatedResponse) {
         setMessages((prev) =>
            prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content: "[No content from AI]" } : msg
            )
         );
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted by user.');
        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiPlaceholderMessageId || (msg.id === aiMessageId && msg.content === '')) ? { ...msg, content: '[Response cancelled by user]', role: 'error' } : msg)
        );
      } else {
        console.error('Chat error:', err);
        setError(err.message || 'An unknown error occurred.');
        setMessages((prev) => [
          ...prev.filter((msg) => msg.id !== aiPlaceholderMessageId && msg.id !== aiMessageId),
          { id: (Date.now() + 3).toString(), role: 'error', content: `Error: ${err.message || 'Failed to get response.'}`, timestamp: new Date() },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className={cn("w-[400px] h-[600px] bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden")}>
      <header className="p-4 border-b border-border/50 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-semibold text-foreground">
          AI Chat
        </h2>
      </header>

      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10">
            Ask the AI anything!
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && messages.find(m=>m.content === "Thinking...") && (
          <MessageItem message={{ id: 'loading-indicator', role: 'model', content: 'Generating response...' }} />
        )}
      </ScrollArea>

      {error && (
        <div className="p-3 text-xs text-destructive bg-destructive/10 border-t border-destructive/50 flex items-center gap-2 shrink-0">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 shrink-0 space-y-2">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Ask Gemini..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-grow bg-background/70"
            disabled={isLoading}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    handleSubmit();
                    e.preventDefault(); 
                }
            }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()} className="bg-primary hover:bg-primary/90">
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizontal size={18} />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
