// src/components/chat-interface.tsx
'use client';

import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageItem, { type Message } from '@/components/message-item';
import ModeToggle, { type ChatbotMode } from '@/components/mode-toggle';
import { SendHorizontal, Loader2, CornerDownLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  initialApiKey: string | null; // For checking if API key is set via profile
}

const ChatInterface: FC<ChatInterfaceProps> = ({ initialApiKey }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [documentText, setDocumentText] = useState(''); // For Document Mode
  const [currentMode, setCurrentMode] = useState<ChatbotMode>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Retrieve API key from localStorage on mount
    const storedKey = localStorage.getItem('geminiUserApiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);
  
  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleModeChange = (newMode: ChatbotMode) => {
    setCurrentMode(newMode);
    setMessages([]); // Clear messages when switching modes
    setInputValue('');
    setDocumentText('');
    setError(null);
    toast({
      title: `Switched to ${newMode === 'chat' ? 'Chat' : 'Document'} Mode`,
      description: newMode === 'document' ? 'Paste your document text below to ask questions about it.' : 'You can now chat generally with the AI.',
    });
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    if (!apiKey) {
      toast({
        variant: 'destructive',
        title: 'API Key Missing',
        description: 'Please set your Gemini API key in the profile settings before sending messages.',
      });
      return;
    }

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
      const requestBody: any = {
        query,
        history: messages.filter(m => m.role === 'user' || m.role === 'model').map(m => ({role: m.role, content: m.content})), // Pass message history
      };
      if (currentMode === 'document' && documentText.trim()) {
        requestBody.documentText = documentText.trim();
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      setMessages((prev) => prev.filter((msg) => msg.id !== aiPlaceholderMessageId)); // Remove placeholder

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: `Request failed: ${response.status}` }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';
      const aiMessageId = (Date.now() + 2).toString();

      // Add a new empty message for the AI response to stream into
      setMessages((prev) => [
        ...prev,
        { id: aiMessageId, role: 'model', content: '', timestamp: new Date() },
      ]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        // Process SSE chunks
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
                // Final message might contain structured data, but for now we just ensure content is updated
                if (jsonData.answer && accumulatedResponse !== jsonData.answer) {
                   setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId ? { ...msg, content: jsonData.answer } : msg
                    )
                  );
                }
                // Handle references or debug info if needed from jsonData.references, jsonData.debugInfo
              } else if (jsonData.type === 'error') {
                throw new Error(jsonData.error || 'Stream error from server');
              }
            } catch (parseError) {
              console.warn('Error parsing SSE JSON:', parseError, "Raw data:", rawData);
              // It might be a non-JSON string chunk if the stream isn't strictly SSE JSON
              if (typeof rawData === 'string' && !rawData.startsWith('{')) {
                 accumulatedResponse += rawData; // Append if it looks like plain text
                 setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId ? { ...msg, content: accumulatedResponse } : msg
                    )
                 );
              }
            }
          } else if (sseMessage.trim()) { // Handle plain text chunks if not strictly SSE
            accumulatedResponse += sseMessage;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content: accumulatedResponse } : msg
              )
            );
          }
        }
      }
      if (!accumulatedResponse) { // If stream ended but no content
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
          prev.map((msg) => (msg.id === aiPlaceholderMessageId || msg.id.startsWith(aiPlaceholderMessageId.substring(0,10)) && msg.content==='Thinking...') ? { ...msg, content: '[Response cancelled by user]', role: 'error' } : msg)
        );
      } else {
        console.error('Chat error:', err);
        setError(err.message || 'An unknown error occurred.');
        setMessages((prev) => [
          ...prev.filter((msg) => msg.id !== aiPlaceholderMessageId),
          { id: (Date.now() + 3).toString(), role: 'error', content: `Error: ${err.message || 'Failed to get response.'}`, timestamp: new Date() },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  // Effect to listen for API key changes from ProfilePopup (via localStorage)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'geminiUserApiKey') {
        setApiKey(event.newValue);
        if (!event.newValue) {
            toast({variant: "destructive", title: "API Key Cleared", description: "Gemini API key was cleared. Chat functionality will be disabled."})
        } else {
            toast({title: "API Key Updated", description: "Gemini API key has been updated for this session."})
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [toast]);


  return (
    <div className={cn("w-[400px] h-[650px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden", currentMode === 'chat' ? 'mode-chat' : 'mode-document')}>
      <header className="p-3 border-b border-border/50 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-semibold text-foreground font-headline">
          AI Chatbot
        </h2>
        <ModeToggle currentMode={currentMode} onModeChange={handleModeChange} />
      </header>

      <div className="chatbot-message-area" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10">
            {currentMode === 'chat' ? 'Ask me anything!' : 'Paste document text below and ask about it.'}
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && messages.find(m=>m.content === "Thinking...") && (
          <MessageItem message={{ id: 'loading-indicator', role: 'model', content: 'Generating response...' }} />
        )}
      </div>

      {error && (
        <div className="p-3 text-xs text-destructive bg-destructive/10 border-t border-destructive/50 flex items-center gap-2 shrink-0">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 shrink-0 space-y-2">
        {currentMode === 'document' && (
          <div>
            <Textarea
              placeholder="Paste your document text here to chat about it..."
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              className="h-28 text-xs bg-background/70 focus:ring-accent"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1 px-1">Provide document context for Document Mode queries.</p>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder={apiKey ? (currentMode === 'chat' ? "Ask Gemini..." : "Ask about the document...") : "Set API Key in Profile first..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-grow bg-background/70 focus:ring-accent"
            disabled={isLoading || !apiKey}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    handleSubmit();
                    e.preventDefault(); 
                }
            }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !apiKey} className={cn("btn-glow-accent-hover", currentMode === 'chat' ? 'bg-mode-chat-accent hover:bg-mode-chat-accent/90' : 'bg-mode-document-accent hover:bg-mode-document-accent/90')}>
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizontal size={18} />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
        {!apiKey && <p className="text-xs text-destructive text-center mt-1">API Key required. Set it via the profile icon.</p>}
      </form>
    </div>
  );
};

export default ChatInterface;
