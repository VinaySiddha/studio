
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType, type Reference } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2, Mic, Pause, StopCircle, Edit2, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ChatTutorSectionProps {
  documentContent: string | null;
  username: string;
}

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentContent, username }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(localStorage.getItem('aiTutorThreadId'));
  const [chatStatus, setChatStatus] = useState("Ready");
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initial message or load history based on currentThreadId
    if (currentThreadId) {
      // TODO: Implement loadChatHistory(currentThreadId) if needed
      // For now, just show thread ID
      setChatStatus(`Thread: ${currentThreadId.substring(0,8)}...`);
    } else if (messages.length === 0) {
       setMessages([{
          id: 'initial-bot-message',
          sender: 'ai',
          text: documentContent ? "Ask me anything about the selected document!" : "Upload or select a document to chat about, or ask a general question.",
          timestamp: new Date(),
        }]);
    }
  }, [documentContent, currentThreadId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages, thinkingMessage]);

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log("Chat stream stopped by user.");
      setIsLoading(false);
      setThinkingMessage(null);
      setChatStatus("Response stopped.");
      // Add a message indicating stop
      setMessages((prev) => [...prev, {
        id: Date.now().toString() + '-stopped',
        sender: 'ai',
        text: "[Response stopped by user]",
        timestamp: new Date()
      }]);
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    if (!documentContent && !messages.some(msg => msg.sender === 'user')) {
        if (!confirm("No document is selected for context. Send message anyway?")) {
            return;
        }
    }

    const userMessageText = inputValue;
    const userMessage: MessageType = {
      id: Date.now().toString() + '-user',
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setChatStatus("AI is thinking...");
    setThinkingMessage("AI is preparing your response..."); // Simplified thinking message

    abortControllerRef.current = new AbortController();
    let currentAiMessageId = Date.now().toString() + '-ai';
    let currentAiMessageText = '';
    let currentAiReferences: Reference[] = [];
    let currentAiThinking: string | undefined = undefined;

    // Add a placeholder for the AI message
    setMessages((prev) => [...prev, {
      id: currentAiMessageId,
      sender: 'ai',
      text: '...', // Placeholder
      timestamp: new Date(),
      isLoading: true,
    }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessageText,
          documentContent: documentContent,
          threadId: currentThreadId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}` }));
        throw new Error(errorData.message || errorData.error || `Failed to connect to chat API. Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const sseMessages = decoder.decode(value, { stream: true }).split('\n\n').filter(Boolean);
        for (const sseMessage of sseMessages) {
          if (sseMessage.startsWith('data: ')) {
            try {
              const data = JSON.parse(sseMessage.substring(6));
              if (data.type === 'chunk' && data.content) {
                currentAiMessageText += data.content;
                setMessages((prev) => prev.map(msg =>
                  msg.id === currentAiMessageId ? { ...msg, text: currentAiMessageText, isLoading: true } : msg
                ));
              } else if (data.type === 'final') {
                currentAiMessageText += data.answer || ''; // Append any final answer part
                currentAiReferences = data.references || [];
                currentAiThinking = data.thinking;
                if (data.threadId && data.threadId !== currentThreadId) {
                  setCurrentThreadId(data.threadId);
                  localStorage.setItem('aiTutorThreadId', data.threadId);
                }
                setMessages((prev) => prev.map(msg =>
                  msg.id === currentAiMessageId ? {
                    ...msg,
                    text: currentAiMessageText || "[AI response finished]",
                    references: currentAiReferences,
                    thinking: currentAiThinking,
                    isLoading: false
                  } : msg
                ));
                setIsLoading(false);
                setThinkingMessage(null);
                setChatStatus(`Ready (Thread: ${ (data.threadId || currentThreadId)?.substring(0,8) }...)`);
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Stream error from server.');
              }
            } catch (parseError) {
              console.error('SSE parse error:', parseError, sseMessage);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Already handled by handleStopStream or will be if isLoading is true
        if (isLoading) {
          setMessages(prev => prev.map(m => m.id === currentAiMessageId && m.isLoading ? {...m, text: "[Response stopped by user]", isLoading: false} : m));
        }
      } else {
        console.error('Error fetching AI response:', error);
        setMessages((prev) => prev.map(msg =>
          msg.id === currentAiMessageId ? {
            ...msg,
            text: `Sorry, I encountered an error: ${error.message}`,
            isError: true,
            isLoading: false
          } : msg
        ));
      }
      setIsLoading(false);
      setThinkingMessage(null);
      setChatStatus("Error occurred.");
    } finally {
      abortControllerRef.current = null;
      // Ensure isLoading is false if not already set by a final chunk or error
      if(isLoading) setIsLoading(false);
      if(thinkingMessage) setThinkingMessage(null);
      if(messages.find(m => m.id === currentAiMessageId && m.isLoading)) {
          setMessages(prev => prev.map(m => m.id === currentAiMessageId && m.isLoading ? {...m, isLoading: false, text: m.text === "..." ? "[Response incomplete]" : m.text} : m));
      }
    }
  };
  
  const handleEditMessage = (messageId: string, newText: string) => {
    // For user messages, this could trigger a re-send. For now, just updates UI.
    // This is a simplified version. True edit might involve more complex state / API calls.
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, text: newText, isEdited: true } : m));
    toast({ title: "Message Edit (UI Demo)", description: "Message text updated in UI. Resending not implemented." });
  };
  
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Failed to copy." }));
  };

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    // TODO: Send feedback to backend if needed
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, feedback: feedbackType } : m));
    toast({ title: `Feedback: ${feedbackType}` });
  };


  return (
    <Card className="h-full flex flex-col glass-panel rounded-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl font-headline">
            <MessageSquare className="mr-2 h-6 w-6 text-primary" />
            Chat Tutor
          </CardTitle>
          <p className="text-xs text-muted-foreground">{chatStatus}</p>
        </div>
        {currentThreadId && <p className="text-xs text-muted-foreground ml-8">Session ID: {currentThreadId.substring(0,8)}...</p>}
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[calc(100vh-22rem)] p-4" ref={scrollAreaRef}>
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onEdit={handleEditMessage}
              onCopy={handleCopyMessage}
              onFeedback={handleFeedback}
            />
          ))}
          {thinkingMessage && (
            <div className="flex items-center justify-start my-4">
                <Loader2 className="h-5 w-5 text-primary animate-spin mr-2" />
                <p className="text-sm text-muted-foreground p-3 bg-muted/70 rounded-lg shadow-md glass-panel !bg-card/50">{thinkingMessage}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t border-border/50 space-y-2 flex-col">
        <div className="flex w-full items-center space-x-2">
          <Button variant="outline" size="icon" disabled={isLoading || !isMediaRecorderSupported} title="Voice Input (Not Implemented)">
            <Mic className="h-4 w-4" /> <span className="sr-only">Voice Input</span>
          </Button>
          <Input
            type="text"
            placeholder={documentContent ? "Ask about the document..." : "Ask a general question..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            disabled={isLoading}
            onKeyPress={(e) => { if (e.key === 'Enter' && !isLoading) handleSendMessage(); }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()} onClick={handleSendMessage} className="btn-glow-primary-hover">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
        {isLoading && (
          <div className="flex w-full items-center justify-end space-x-2">
            {/* Pause button can be added here - full functionality is complex with native fetch streams */}
            {/* <Button variant="outline" size="sm" onClick={handlePauseStream} title="Pause Response (Not fully implemented)">
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button> */}
            <Button variant="destructive" size="sm" onClick={handleStopStream} title="Stop Response">
              <StopCircle className="h-4 w-4 mr-1" /> Stop
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ChatTutorSection;
