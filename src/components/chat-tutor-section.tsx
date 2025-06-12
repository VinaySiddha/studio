
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType, type Reference } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2, Mic, Pause, StopCircle, Files, History, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { listChatThreadsAction, getThreadHistoryAction, createNewChatThreadAction } from '@/app/actions';

interface ChatTutorSectionProps {
  documentName: string | null; 
  username: string;
  authToken: string | null; 
}

interface Thread {
  thread_id: string;
  title: string;
  last_updated: string; 
  // Add other fields if your Flask backend provides them
}

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentName, username, authToken }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [chatStatusText, setChatStatusText] = useState("Initializing...");
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);
  const [isMediaRecorderSupported, setIsMediaRecorderSupported] = useState(false);
  
  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [availableThreads, setAvailableThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  
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
      loadChatHistory(storedThreadId);
      setChatStatusText(`Ready (Thread: ${storedThreadId.substring(0,8)}...)`);
    } else {
      setMessages([{
        id: 'initial-bot-message',
        sender: 'ai',
        text: documentName ? `Ask me anything about ${documentName}!` : "Upload or select a document to chat about, or ask a general question.",
        timestamp: new Date(),
      }]);
      setChatStatusText("Ready");
    }
  }, [documentName]); 

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

    try {
      const requestBody = {
        query: query,
        documentContent: documentName || "No document provided for context.", // Pass filename or placeholder
        threadId: currentThreadId,
        // authToken: authToken, // Pass token if /api/chat needs it for Flask
      };
      
      const response = await fetch('/api/chat', { // Calls Next.js API route which proxies to Flask
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
              if (data.type === 'thinking' && data.message) {
                // Flask's /chat stream sends thinking messages
                setThinkingMessage(data.message);
              } else if (data.type === 'chunk' && data.content) {
                currentAiMessageText += data.content;
                setMessages((prev) => prev.map(msg =>
                  msg.id === currentAiMessageId ? { ...msg, text: currentAiMessageText, isLoading: true } : msg
                ));
              } else if (data.type === 'final') {
                currentAiMessageText = data.answer || currentAiMessageText || ""; // Ensure final answer part is appended or replaces if it's the whole answer
                const finalThreadId = data.thread_id || currentThreadId;
                if (finalThreadId && finalThreadId !== currentThreadId) {
                  setCurrentThreadId(finalThreadId);
                  localStorage.setItem('aiTutorThreadId', finalThreadId);
                }
                setMessages((prev) => prev.map(msg =>
                  msg.id === currentAiMessageId ? {
                    ...msg,
                    text: currentAiMessageText || "[AI response finished]",
                    references: data.references || [],
                    thinking: data.thinking, // This is the CoT block from Flask
                    isLoading: false
                  } : msg
                ));
                setIsLoading(false);
                setThinkingMessage(null); // Clear intermediate thinking message
                setChatStatusText(`Ready (Thread: ${finalThreadId?.substring(0,8)}...)`);
              } else if (data.type === 'error') {
                throw new Error(data.error || data.message || 'Stream error from server.');
              }
            } catch (parseError) {
              console.error('SSE parse error:', parseError, "Raw SSE:", sseMessage);
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
       const finalStatusThreadId = currentThreadId || "New Chat";
      setChatStatusText(prev => prev.startsWith("Error:") ? prev : `Ready (Thread: ${finalStatusThreadId === "New Chat" ? "New" : finalStatusThreadId.substring(0,8)}...)`);
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
  };

  const handleNewChat = async () => {
    if (!authToken) {
        toast({variant: "destructive", title: "Error", description: "Login to start a new chat."});
        return;
    }
    setIsLoading(true);
    setChatStatusText("Starting new chat...");
    try {
      const result = await createNewChatThreadAction(authToken, "New Chat " + new Date().toLocaleTimeString());
      if (result.error || !result.thread_id) {
        throw new Error(result.error || "Failed to create new thread on Flask backend.");
      }
      setCurrentThreadId(result.thread_id);
      localStorage.setItem('aiTutorThreadId', result.thread_id);
      setMessages([{
        id: 'new-chat-initial-msg-' + result.thread_id,
        sender: 'ai',
        text: "New chat session started. How can I help you?",
        timestamp: new Date(),
      }]);
      setChatStatusText(`Ready (Thread: ${result.thread_id.substring(0,8)}...)`);
      toast({ title: "New Chat Started" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "New Chat Error", description: error.message });
      setChatStatusText("Error starting new chat.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowSessions = async () => {
    if (!authToken) {
      toast({ variant: "destructive", title: "Error", description: "Login to view sessions." });
      return;
    }
    setIsLoadingThreads(true);
    setIsSessionsDialogOpen(true); 
    try {
      const result = await listChatThreadsAction(authToken);
      if (result.error) {
        throw new Error(result.error);
      }
      setAvailableThreads(result.threads || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Loading Sessions", description: error.message });
      setAvailableThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadChatHistory = async (threadIdToLoad: string) => {
    if (!authToken) {
      toast({ variant: "destructive", title: "Authentication Error", description: "Cannot load history." });
      return;
    }
    setIsLoading(true);
    setChatStatusText(`Loading history for thread ${threadIdToLoad.substring(0,8)}...`);
    setMessages([]); // Clear current messages
    try {
      const result = await getThreadHistoryAction(authToken, threadIdToLoad);
      if (result.error) {
        throw new Error(result.error);
      }
      const fetchedMessages: MessageType[] = (result.messages || []).map((msg: any) => ({
        id: msg.message_id || msg._id || String(Date.now() + Math.random()),
        sender: msg.sender,
        text: msg.message_text,
        timestamp: new Date(msg.timestamp),
        references: msg.references || [], // Assuming Flask parses references_json
        thinking: msg.thinking || msg.cot_reasoning,
        isEdited: msg.is_edited,
        isError: msg.is_error,
      }));
      setMessages(fetchedMessages);
      setCurrentThreadId(threadIdToLoad);
      localStorage.setItem('aiTutorThreadId', threadIdToLoad);
      setChatStatusText(`Ready (Thread: ${threadIdToLoad.substring(0,8)}...)`);
      if (fetchedMessages.length === 0) {
          toast({ title: "Empty Thread", description: "This chat session has no messages yet." });
          setMessages([{id: 'empty-thread-msg', sender: 'ai', text: "This chat is empty. Ask something!", timestamp: new Date()}]);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Loading History", description: error.message });
      setChatStatusText("Error loading history.");
      setMessages([{id: 'load-error-msg', sender: 'ai', text: `Error loading chat: ${error.message}`, timestamp: new Date(), isError: true}]);
    } finally {
      setIsLoading(false);
      setIsSessionsDialogOpen(false);
    }
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
            <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleShowSessions} title="View previous chat sessions" disabled={!authToken || isLoading}>
                  <History className="mr-1 h-4 w-4" /> Sessions
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px] glass-panel">
                <DialogHeader>
                  <DialogTitle>Previous Chat Sessions</DialogTitle>
                  <DialogDescription>Select a session to load its history.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  {isLoadingThreads ? (
                    <div className="flex justify-center items-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2">Loading sessions...</span>
                    </div>
                  ) : availableThreads.length > 0 ? (
                    <ul className="space-y-2">
                      {availableThreads.map((thread) => (
                        <li key={thread.thread_id}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-left h-auto py-2 px-3"
                            onClick={() => loadChatHistory(thread.thread_id)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{thread.title || `Session ${thread.thread_id.substring(0,8)}`}</span>
                              <span className="text-xs text-muted-foreground">
                                Last updated: {new Date(thread.last_updated).toLocaleString()}
                              </span>
                            </div>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No previous sessions found.</p>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
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
          />
          <Button variant="outline" size="icon" disabled={!isLoading} title="Pause AI Response (Not Implemented)">
            <Pause className="h-4 w-4" /> <span className="sr-only">Pause</span>
          </Button>
          <Button variant="outline" size="icon" type="button" disabled={!isLoading} onClick={handleStopStream} title="Stop AI Response">
            <StopCircle className="h-4 w-4" /> <span className="sr-only">Stop</span>
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !authToken} className="btn-glow-primary-hover">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatTutorSection;
