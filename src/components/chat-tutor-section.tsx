
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2 } from 'lucide-react';
import { chatTutor } from '@/app/actions'; // Server action

interface ChatTutorSectionProps {
  documentContent: string | null; // Current way; JS logic implies thread_id based context
  username: string; // For potential display or context
  // TODO: Add props for threadId, backendStatus if adapting full JS logic
}

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentContent, username }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // TODO: Replace with backend status and thread ID logic from JS
  const [status, setStatus] = useState("Ready | 0 Vectors"); 
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This effect is simplified. The JS code has more complex status updates
    // based on backend status, thread ID, and document vectors.
    if (documentContent) {
      setStatus(`Context: Active Document | ${Math.floor(Math.random() * 500) + 100} Vectors (mock)`);
    } else {
      setStatus("Upload/select a document to provide context");
    }
    // Simulate session ID from JS logic (this would typically come from backend or be managed)
    if (!sessionId) {
      setSessionId((Math.random() + 1).toString(36).substring(7));
    }
  }, [documentContent, sessionId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    // TODO: The JS code's `handleSendMessage` is much more complex:
    // - Uses `currentThreadId`
    // - Handles streaming responses with 'thinking', 'chunk', 'final', 'error' types.
    // - Manages abortController, pause/stop.
    // - This current implementation is simplified and uses the existing chatTutor action.
    if (!inputValue.trim()) return;
    if (!documentContent && !confirm("No document is selected for context. Send message anyway?")) {
        return;
    }


    const userMessage: MessageType = {
      id: Date.now().toString() + 'user',
      sender: 'user',
      text: inputValue,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setStatus("AI is thinking...");

    try {
      // The JS logic has a dedicated /chat endpoint. This uses the existing chatTutor action.
      // This action expects documentContent. If we move to thread-based context, this needs to change.
      const aiResponse = await chatTutor({ 
        documentContent: documentContent || "User is asking a general question without document context.", // Provide fallback if no doc
        question: currentInput 
      });
      const aiMessage: MessageType = {
        id: Date.now().toString() + 'ai',
        sender: 'ai',
        text: aiResponse.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage: MessageType = {
        id: Date.now().toString() + 'ai-error',
        sender: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Simplified status update
      if (documentContent) {
        setStatus(`Context: Active Document | ${Math.floor(Math.random() * 500) + 100} Vectors (mock)`);
      } else {
        setStatus("Upload/select a document to provide context");
      }
    }
  };

  return (
    <Card className="h-full flex flex-col glass-panel rounded-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl font-headline">
            <MessageSquare className="mr-2 h-6 w-6 text-primary" />
            Chat Tutor
          </CardTitle>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
        {sessionId && <p className="text-xs text-muted-foreground ml-8">Session ID: {sessionId}</p>}
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[calc(100vh-20rem)] p-4" ref={scrollAreaRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare size={48} className="mb-4" />
              <p>Ask questions about the selected document, or general questions.</p>
              {!documentContent && <p className="text-sm mt-1">No document selected for specific context.</p>}
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t border-border/50">
        {/* TODO: The JS code includes voice input, pause, stop buttons. These are not yet implemented here. */}
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            type="text"
            placeholder={documentContent ? "Ask about the document..." : "Ask a general question..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            disabled={isLoading /* TODO: || !backendIsReady from JS logic */}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() /* TODO: || !backendIsReady */} className="btn-glow-primary-hover">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatTutorSection;
