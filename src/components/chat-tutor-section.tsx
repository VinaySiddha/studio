
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType, type Reference } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2, Mic, Pause, StopCircle, Files, History } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ChatTutorSectionProps {
  documentName: string | null; // Name of the currently selected document for context
  username: string;
  authToken: string | null; // Auth token for API calls
}

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentName, username, authToken }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [chatStatusText, setChatStatusText] = useState("Initializing...");
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);
  const [isMediaRecorderSupported, setIsMediaRecorderSupported] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const FLASK_BACKEND_URL = process.env.NEXT_PUBLIC_FLASK_BACKEND_URL || 'http://localhost:5000';


  useEffect(() => {
    setIsMediaRecorderSupported(
      typeof window !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
    );
  }, []);

  useEffect(() => {
    const storedThreadId = localStorage.getItem('aiTutorThreadId');
    if (storedThreadId) {
      setCurrentThreadId(storedThreadId);
      // TODO: Implement loadChatHistory(storedThreadId) if Flask backend supports it
      // For now, we assume Flask handles history based on thread_id passed in /chat
      setChatStatusText(`Ready (Thread: ${storedThreadId.substring(0,8)}...)`);
      // If using Flask for history, call a function to load it here.
      // loadFlaskChatHistory(storedThreadId);
    } else if (messages.length === 0) {
       setMessages([{
          id: 'initial-bot-message',
          sender: 'ai',
          text: documentName ? `Ask me anything about ${documentName}!` : "Upload or select a document to chat about, or ask a general question.",
          timestamp: new Date(),
        }]);
       setChatStatusText("Ready");
    }
  }, [documentName]); // Re-evaluate initial message if documentName changes

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
      setIsLoading(false);
      setThinkingMessage(null);
      setChatStatusText("Response stopped.");
      setMessages((prev) => prev.map(m => m.isLoading ? {...m, text: m.text === '...' ? "[Response stopped by user]" : m.text + "\n[Response stopped by user]", isLoading: false} : m));
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;
    if (!authToken) {
      toast({ variant: "destructive", title: "Error", description: "You must be logged in to chat." });
      return;
    }

    const userMessage: MessageType = {
      id: Date.now().toString() + '-user',
      sender: 'user',
      text: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setChatStatusText("AI Tutor is thinking...");
    setThinkingMessage("AI is preparing your response..."); 

    abortControllerRef.current = new AbortController();
    let currentAiMessageId = Date.now().toString() + '-ai';
    let currentAiMessageText = '';

    setMessages((prev) => [...prev, {
      id: currentAiMessageId,
      sender: 'ai',
      text: '...', 
      timestamp: new Date(),
      isLoading: true,
    }]);

    // Determine if we use Next.js /api/chat (Genkit) or Flask /chat
    // For this example, we'll keep using the Next.js Genkit stream for chat.
    // If Flask is to handle chat, this fetch call needs to target Flask.
    const chatApiEndpoint = '/api/chat'; // Stays as Next.js API route using Genkit
    // const chatApiEndpoint = `${FLASK_BACKEND_URL}/chat`; // If Flask handles chat

    try {
      const requestBody = {
        query: query,
        documentContent: documentName, // If Next.js /api/chat needs filename for context
                                       // Or send full content if that's how your Genkit prompt is set up
        threadId: currentThreadId,
      };
      
      const response = await fetch(chatApiEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${authToken}` // Add if chatApiEndpoint is Flask and secured
        },
        body: JSON.stringify(requestBody),
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
                currentAiMessageText += data.answer || ''; // Ensure final answer part is appended
                const finalThreadId = data.threadId || currentThreadId;
                if (finalThreadId && finalThreadId !== currentThreadId) {
                  setCurrentThreadId(finalThreadId);
                  localStorage.setItem('aiTutorThreadId', finalThreadId);
                }
                setMessages((prev) => prev.map(msg =>
                  msg.id === currentAiMessageId ? {
                    ...msg,
                    text: currentAiMessageText || "[AI response finished]",
                    references: data.references || [],
                    thinking: data.thinking,
                    isLoading: false
                  } : msg
                ));
                setIsLoading(false);
                setThinkingMessage(null);
                setChatStatusText(`Ready (Thread: ${finalThreadId?.substring(0,8)}...)`);
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
         setMessages(prev => prev.map(m => m.id === currentAiMessageId && m.isLoading ? {...m, text: (m.text === "..." ? "" : m.text) + "[Response stopped by user]", isLoading: false} : m));
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
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setThinkingMessage(null);
      if (messages.find(m => m.id === currentAiMessageId && m.isLoading)) {
        setMessages(prev => prev.map(m => m.id === currentAiMessageId && m.isLoading ? {...m, isLoading: false, text: m.text === "..." ? "[Response incomplete]" : m.text } : m));
      }
      setChatStatusText(prev => prev.startsWith("Error:") ? prev : `Ready (Thread: ${currentThreadId?.substring(0,8)}...)`);
    }
  };
  
  const handleEditMessage = (messageId: string, newText: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, text: newText, isEdited: true } : m));
    toast({ title: "Message Edit (UI Demo)", description: "If this were a real app, we might re-submit this to the AI or Flask." });
  };
  
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Failed to copy." }));
  };

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, feedback: feedbackType } : m));
    toast({ title: `Feedback: ${feedbackType}` });
    // TODO: Send feedback to Flask backend if it supports it
  };

  const handleNewChat = async () => {
    if (!authToken) {
        toast({variant: "destructive", title: "Error", description: "Login to start a new chat."});
        return;
    }
    // This logic assumes new chat thread creation is handled by Flask
    // or that clearing local thread ID is enough if Next.js /api/chat handles threads.
    // For Flask:
    // try {
    //   const response = await fetch(`${FLASK_BACKEND_URL}/chat/thread`, { /* or similar endpoint */
    //     method: 'POST',
    //     headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ title: "New Chat " + new Date().toISOString() })
    //   });
    //   const data = await response.json();
    //   if (!response.ok) throw new Error(data.error || "Failed to create new thread on Flask.");
    //   setCurrentThreadId(data.thread_id);
    //   localStorage.setItem('aiTutorThreadId', data.thread_id);
    //   setMessages([{ id: 'new-chat-initial-msg', sender: 'ai', text: "New chat started with Flask. Ask away!", timestamp: new Date() }]);
    //   setChatStatusText(`Ready (Thread: ${data.thread_id.substring(0,8)}...)`);
    //   toast({ title: "New Chat Started (Flask)" });
    // } catch (error: any) {
    //   toast({ variant: "destructive", title: "New Chat Error", description: error.message });
    // }

    // For current Genkit-based chat:
    localStorage.removeItem('aiTutorThreadId');
    setCurrentThreadId(null);
    setMessages([{
      id: 'new-chat-initial-msg',
      sender: 'ai',
      text: "Started a new chat. Ask your question!",
      timestamp: new Date(),
    }]);
    setChatStatusText("Ready (New Chat)");
    toast({ title: "New Chat Started" });
  };

  const handleShowSessions = () => {
    // TODO: Implement session loading from Flask and display logic
    // This would involve fetching a list of threads from Flask, e.g., GET /threads
    // then displaying them in a modal or list for selection.
    toast({ title: "Show Previous Sessions (Not Implemented with Flask yet)", description: "This would show past conversations from Flask." });
  };

  return (
    <Card className="h-full flex flex-col glass-panel rounded-lg">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl font-headline">
            <MessageSquare className="mr-2 h-6 w-6 text-primary" />
            Chat Tutor
            {currentThreadId && <span className="ml-2 text-xs text-muted-foreground">(Thread: {currentThreadId.substring(0,8)}...)</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewChat} title="Start a new chat session" disabled={!authToken || isLoading}>
              <Files className="mr-1 h-4 w-4" /> New Chat
            </Button>
            <Button variant="outline" size="sm" onClick={handleShowSessions} title="View previous chat sessions (Not Implemented)" disabled={!authToken || isLoading}>
              <History className="mr-1 h-4 w-4" /> Sessions
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[calc(100vh-25rem)] p-4" ref={scrollAreaRef}> {/* Adjusted max-h */}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onEdit={handleEditMessage}
              onCopy={handleCopyMessage}
              onFeedback={handleFeedback}
            />
          ))}
          {thinkingMessage && isLoading && (
             <div className="flex items-center justify-start my-4 ml-11"> {/* Aligned with AI messages */}
                <Loader2 className="h-5 w-5 text-primary animate-spin mr-2" />
                <p className="text-sm text-muted-foreground p-3 bg-muted/70 rounded-lg shadow-md glass-panel !bg-card/50">{thinkingMessage}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t border-border/50 flex-col space-y-2">
        <p className="text-xs text-muted-foreground w-full text-center">{chatStatusText}</p>
        <div className="flex w-full items-center space-x-2">
          <Button variant="outline" size="icon" disabled={isLoading || !isMediaRecorderSupported || !authToken} title={!authToken ? "Login to use voice" : (isMediaRecorderSupported ? "Voice Input (Not Implemented)" : "Voice input not supported")}>
            <Mic className="h-4 w-4" /> <span className="sr-only">Voice Input</span>
          </Button>
          <Input
            type="text"
            placeholder={documentName ? `Ask about ${documentName}...` : "Ask a general question..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            disabled={isLoading || !authToken}
            onKeyPress={(e) => { if (e.key === 'Enter' && !isLoading && authToken) handleSendMessage(); }}
          />
          <Button variant="outline" size="icon" disabled={!isLoading} title="Pause AI Response (Not Implemented)">
            <Pause className="h-4 w-4" /> <span className="sr-only">Pause</span>
          </Button>
          <Button variant="outline" size="icon" disabled={!isLoading} onClick={handleStopStream} title="Stop AI Response">
            <StopCircle className="h-4 w-4" /> <span className="sr-only">Stop</span>
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !authToken} onClick={handleSendMessage} className="btn-glow-primary-hover">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ChatTutorSection;
