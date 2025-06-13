
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType, type Reference } from '@/components/chat-message'; // Updated import
import { SendHorizontal, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Assuming you have this hook
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

const ChatInterface: FC = () => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new message or loading change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;

    setIsLoading(true);
    setError(null);
    const userMessageId = Date.now().toString();
    setMessages((prevMessages) => [
      ...prevMessages,
      { id: userMessageId, sender: 'user', text: query, timestamp: new Date() },
    ]);
    setInputValue('');

    // Placeholder for AI response to show loading
    const aiMessageId = (Date.now() + 1).toString();
    setMessages((prevMessages) => [
      ...prevMessages,
      { id: aiMessageId, sender: 'ai', text: '', timestamp: new Date(), isLoading: true },
    ]);

    abortControllerRef.current = new AbortController();
    let accumulatedResponse = "";

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history: messages.filter(m => !m.isLoading) }), // Send history
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: `Request failed: ${response.status}` }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamEnded = false;

      while (!streamEnded) {
        const { value, done } = await reader.read();
        if (done) {
          streamEnded = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const sseMessages = chunk.split('\n\n').filter(Boolean);

        for (const sseMessage of sseMessages) {
          if (sseMessage.startsWith('data: ')) {
            const rawData = sseMessage.substring(6);
            try {
              const jsonData = JSON.parse(rawData);
              if (jsonData.type === 'chunk' && jsonData.content) {
                accumulatedResponse += jsonData.content;
                setMessages(prev => prev.map(m => 
                  m.id === aiMessageId ? {...m, text: accumulatedResponse, isLoading: true } : m
                ));
              } else if (jsonData.type === 'final' && jsonData.answer) {
                accumulatedResponse = jsonData.answer; // Final answer might replace accumulated chunks
                const finalReferences = jsonData.references as Reference[] || [];
                const finalThinking = jsonData.thinking as string || null;
                setMessages(prev => prev.map(m => 
                  m.id === aiMessageId ? {...m, text: accumulatedResponse, isLoading: false, references: finalReferences, thinking: finalThinking } : m
                ));
                streamEnded = true; // Assume 'final' means end of stream
              } else if (jsonData.type === 'error') {
                 throw new Error(jsonData.error || 'Stream error from backend');
              }
            } catch (parseError) {
              console.warn('Error parsing SSE JSON, appending as text:', parseError, "Raw data:", rawData);
              // If it's not JSON or fails to parse, and isn't a known SSE control message, treat as part of the answer
              if (!rawData.startsWith("event:") && !rawData.startsWith("id:") && !rawData.startsWith("retry:")) {
                accumulatedResponse += rawData + "\n"; // Add newline as raw data might be multi-line without SSE structure
                 setMessages(prev => prev.map(m => 
                    m.id === aiMessageId ? {...m, text: accumulatedResponse, isLoading: true } : m
                ));
              }
            }
          }
        }
      }
      if(!messages.find(m => m.id === aiMessageId)?.text && accumulatedResponse){
         setMessages(prev => prev.map(m => 
            m.id === aiMessageId ? {...m, text: accumulatedResponse, isLoading: false } : m
        ));
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, text: accumulatedResponse + "\n[Response stopped by user]", isLoading: false, isError: true } : m));
        toast({ title: "Response Stopped", variant: "default" });
      } else {
        console.error('Chat error:', err);
        setError(err.message || 'Failed to get response.');
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, text: `Error: ${err.message || 'Failed to get response.'}`, isLoading: false, isError: true } : m));
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
      // Ensure isLoading is false for the AI message if it wasn't updated by a 'final' event
      setMessages(prev => prev.map(m => m.id === aiMessageId && m.isLoading ? {...m, isLoading: false, text: accumulatedResponse || "[AI response processing ended]" } : m));
      abortControllerRef.current = null;
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Failed to copy." }));
  };

  return (
    <Card className="w-full h-[70vh] md:h-[calc(100vh-12rem)] flex flex-col shadow-2xl">
      <CardHeader className="border-b">
        {/* Optional: Add title or status here */}
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onCopy={handleCopy} />
          ))}
          {isLoading && messages.every(m => !m.isLoading) && (
            <div className="flex items-center text-sm text-muted-foreground p-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              AI is thinking...
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t">
        {error && (
          <div className="text-xs text-destructive mb-2 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
          <Input
            type="text"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-input text-foreground placeholder:text-muted-foreground"
            disabled={isLoading}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()} className="bg-primary hover:bg-primary/90">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatInterface;
