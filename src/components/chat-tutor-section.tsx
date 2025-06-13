
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2, Mic, StopCircle, Files, History, Edit3, Trash2, Check, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDFooter, AlertDialogHeader as AlertDHeader, AlertDialogTitle as AlertDTitle } from '@/components/ui/alert-dialog';

import {
  listChatThreadsAction,
  getThreadHistoryAction,
  createNewChatThreadAction,
  renameChatThreadAction,
  deleteChatThreadAction,
  transcribeAudioAction
} from '@/app/actions';
import type { User } from '@/app/page';

interface ChatTutorSectionProps {
  documentSecuredName: string | null; // Secured name for API
  documentOriginalName: string | null; // Original name for display
  user: User;
  onClearDocumentContext: () => void; // To reset AppContent's state when new chat is forced
}

interface Thread {
  thread_id: string;
  title: string;
  last_updated: string; 
  // Add user_id if your Flask backend returns it and it's useful here
}

const GENERAL_QUERY_PLACEHOLDER = "No document provided for context."; // Matches Flask

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentSecuredName, documentOriginalName, user, onClearDocumentContext }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [chatStatusText, setChatStatusText] = useState("Initializing chat...");
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const [isSessionsDialogOpen, setIsSessionsDialogOpen] = useState(false);
  const [availableThreads, setAvailableThreads] = useState<Thread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [threadToRename, setThreadToRename] = useState<Thread | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [threadToDelete, setThreadToDelete] = useState<Thread | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const isBrowser = typeof window !== 'undefined';
  const isMediaRecorderSupported = isBrowser && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  // Update chat status text when document context changes
  useEffect(() => {
    if (documentOriginalName) {
      setChatStatusText(`Chatting about: ${documentOriginalName.substring(0,30)}${documentOriginalName.length > 30 ? '...' : ''}`);
    } else {
      setChatStatusText("General Chat Mode");
    }
  }, [documentOriginalName]);

  // Load initial thread or set initial message
  useEffect(() => {
    const storedThreadId = localStorage.getItem('aiTutorThreadId');
    if (storedThreadId) {
      setCurrentThreadId(storedThreadId);
      if (user.token) loadChatHistory(storedThreadId);
    } else {
      setMessages([{
        id: 'initial-bot-msg', sender: 'ai',
        text: "Welcome to the AI Engineering Tutor! Select a document or ask a general question.",
        timestamp: new Date(),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.token]); // Only on initial mount or user token change


  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isLoading]); // isLoading also to scroll thinking message into view

  const fetchThreads = useCallback(async (showToast = false) => {
    if (!user.token) return;
    setIsLoadingThreads(true);
    try {
      const result = await listChatThreadsAction(user.token);
      if (result.error) throw new Error(result.error);
      setAvailableThreads(result.threads?.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()) || []);
      if (showToast) toast({title: "Sessions Loaded", description: `${result.threads?.length || 0} sessions found.`});
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Loading Sessions", description: error.message });
      setAvailableThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [user.token, toast]);

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("User stopped response");
      // isLoading will be set to false in handleSendMessage's finally block
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;
    if (!user.token) {
      toast({ variant: "destructive", title: "Authentication Error", description: "Please login to chat." });
      return;
    }

    const userMessage: MessageType = { id: Date.now().toString() + '-user', sender: 'user', text: query, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setChatStatusText("AI Tutor is thinking...");

    abortControllerRef.current = new AbortController();
    const aiMessageId = Date.now().toString() + '-ai';
    
    // Add a placeholder AI message for streaming
    setMessages(prev => [...prev, {
        id: aiMessageId, sender: 'ai', text: '', isLoading: true, timestamp: new Date()
    }]);
    let accumulatedResponse = "";

    try {
      const requestBodyForFlask = {
        query,
        documentContent: documentSecuredName || GENERAL_QUERY_PLACEHOLDER,
        thread_id: currentThreadId, // Flask expects thread_id
        // Auth token is passed via header in actions.ts -> fetchFlaskAPI
      };
      
      // Using Next.js API route to proxy to Flask
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({
            query: requestBodyForFlask.query,
            documentContent: requestBodyForFlask.documentContent,
            threadId: requestBodyForFlask.thread_id,
            authToken: user.token // Pass token for the Next.js API route to use
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: `Request failed: ${response.status}` }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let flaskResponseEnded = false;

      while (!flaskResponseEnded) {
        const { value, done } = await reader.read();
        if (done) {
          flaskResponseEnded = true;
          break;
        }
        const sseMessages = decoder.decode(value, { stream: true }).split('\n\n').filter(Boolean);
        
        for (const sseMessage of sseMessages) {
          if (sseMessage.startsWith('data: ')) {
            const rawData = sseMessage.substring(6);
            try {
              const jsonData = JSON.parse(rawData);
              if (jsonData.type === 'thinking') {
                setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, thinking: jsonData.message} : m));
              } else if (jsonData.type === 'chunk' || (jsonData.answer && !jsonData.type)) { // Handle chunk or direct answer part
                const contentToAdd = jsonData.content || jsonData.answer || "";
                accumulatedResponse += contentToAdd;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, text: accumulatedResponse, isLoading: true} : m));
              } else if (jsonData.type === 'final') { // Flask SSE structure
                accumulatedResponse = jsonData.answer || accumulatedResponse;
                const finalThreadId = jsonData.thread_id || currentThreadId;
                if (finalThreadId && finalThreadId !== currentThreadId) {
                    setCurrentThreadId(finalThreadId);
                    localStorage.setItem('aiTutorThreadId', finalThreadId);
                }
                setMessages(prev => prev.map(m => m.id === aiMessageId ? {
                    ...m, 
                    text: accumulatedResponse, 
                    references: jsonData.references || [], 
                    thinking: jsonData.thinking || m.thinking, // Preserve thinking if already set
                    isLoading: false,
                  } : m));
                flaskResponseEnded = true; // Assume final message means stream end from Flask
              } else if (jsonData.type === 'error') {
                throw new Error(jsonData.error || 'Stream error from backend');
              }
            } catch (parseError: any) {
              console.warn('Error parsing Flask SSE JSON:', parseError, "Raw SSE data:", rawData);
              // If it's not JSON, append as text
              accumulatedResponse += rawData;
               setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, text: accumulatedResponse, isLoading: true} : m));
            }
          }
        }
      }
      // After loop, ensure isLoading is false for the AI message if it wasn't marked by 'final'
      setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, isLoading: false, text: accumulatedResponse || "[AI response ended]" } : m));

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, text: accumulatedResponse + "\n[Response stopped by user]", isLoading: false, isError: true} : m));
      } else {
        console.error('Chat error:', err);
        setMessages(prev => prev.map(m => m.id === aiMessageId ? {...m, text: `Error: ${err.message || 'Failed to get response.'}`, isLoading: false, isError: true} : m));
      }
    } finally {
      setIsLoading(false);
      if (documentOriginalName) setChatStatusText(`Chatting about: ${documentOriginalName.substring(0,30)}${documentOriginalName.length > 30 ? '...' : ''}`);
      else setChatStatusText("General Chat Mode");
      abortControllerRef.current = null;
    }
  };
  
  const handleEditMessage = (messageId: string, newText: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, text: newText, isEdited: true, timestamp: new Date() } : m));
    toast({ title: "Message Updated", description: "Your message has been updated locally." });
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Failed to copy." }));
  };

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, feedback: m.feedback === feedbackType ? undefined : feedbackType } : m));
    toast({ title: `Feedback: ${feedbackType} submitted (locally)` });
  };

  const handleNewChat = async () => {
    if (!user.token) { toast({variant: "destructive", title: "Login Required"}); return; }
    setIsLoading(true);
    setChatStatusText("Starting new chat...");
    onClearDocumentContext(); // Clears document selection in AppContent
    try {
      const result = await createNewChatThreadAction(user.token, "New Chat " + new Date().toLocaleTimeString().substring(0,8));
      if (result.error || !result.thread_id) throw new Error(result.error || "Failed to create new thread.");
      setCurrentThreadId(result.thread_id);
      localStorage.setItem('aiTutorThreadId', result.thread_id);
      setMessages([{ id: 'new-chat-init-' + result.thread_id, sender: 'ai', text: "New chat session started!", timestamp: new Date() }]);
      setChatStatusText(`General Chat Mode (Thread: ${result.thread_id.substring(0,8)}...)`);
      toast({ title: "New Chat Started" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "New Chat Error", description: error.message });
    } finally { setIsLoading(false); }
  };

  const handleShowSessions = async () => {
    if (!user.token) { toast({variant: "destructive", title: "Login Required"}); return; }
    setIsLoadingThreads(true);
    setIsSessionsDialogOpen(true);
    await fetchThreads(true);
  };

  const loadChatHistory = async (threadIdToLoad: string) => {
    if (!user.token) return;
    setIsLoading(true);
    setChatStatusText(`Loading history...`);
    setMessages([]);
    onClearDocumentContext(); // Reset document context when loading history
    try {
      const result = await getThreadHistoryAction(user.token, threadIdToLoad);
      if (result.error) throw new Error(result.error);
      const fetchedMessages: MessageType[] = (result.messages || []).map((msg: any) => ({
        id: msg.message_id || msg._id || String(Date.now() + Math.random()),
        sender: msg.sender.toLowerCase() as 'user' | 'ai' | 'bot',
        text: msg.message_text,
        timestamp: new Date(msg.timestamp),
        references: (msg.references && Array.isArray(msg.references)) ? msg.references : (msg.references_json ? JSON.parse(msg.references_json) : []),
        thinking: msg.thinking || msg.cot_reasoning,
        isEdited: msg.is_edited || false,
        isError: msg.is_error || false,
      }));
      setMessages(fetchedMessages);
      setCurrentThreadId(threadIdToLoad);
      localStorage.setItem('aiTutorThreadId', threadIdToLoad);
      // Determine title for status
      const currentLoadedThread = availableThreads.find(t => t.thread_id === threadIdToLoad) || {title: `Thread ${threadIdToLoad.substring(0,8)}...`};
      setChatStatusText(`Loaded: ${currentLoadedThread.title}`);
      if (fetchedMessages.length === 0) toast({ title: "Empty Thread" });
      else toast({ title: "Chat History Loaded" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Loading History", description: error.message });
      setMessages([{id: 'load-error', sender: 'ai', text: `Error: ${error.message}`, timestamp: new Date(), isError: true}]);
    } finally { setIsLoading(false); setIsSessionsDialogOpen(false); }
  };

  const handleRenameThread = async () => {
    if (!threadToRename || !newThreadTitle.trim() || !user.token) return;
    try {
      await renameChatThreadAction(user.token, threadToRename.thread_id, newThreadTitle.trim());
      toast({ title: "Thread Renamed" });
      await fetchThreads();
    } catch (error: any) { toast({ variant: "destructive", title: "Rename Failed", description: error.message }); }
    setThreadToRename(null); setNewThreadTitle("");
  };

  const handleDeleteThread = async () => {
    if (!threadToDelete || !user.token) return;
    try {
      await deleteChatThreadAction(user.token, threadToDelete.thread_id);
      toast({ title: "Thread Deleted" });
      if (currentThreadId === threadToDelete.thread_id) {
        setCurrentThreadId(null); localStorage.removeItem('aiTutorThreadId');
        setMessages([{id: 'deleted-active-thread', sender: 'ai', text: "Current chat deleted. Start new or load another.", timestamp: new Date()}]);
        onClearDocumentContext();
      }
      await fetchThreads();
    } catch (error: any) { toast({ variant: "destructive", title: "Deletion Failed", description: error.message }); }
    setThreadToDelete(null);
  };

  const startRecording = async () => {
    if (!isMediaRecorderSupported || !user.token) {
      toast({title: "Voice input unavailable/not logged in.", variant: "destructive"}); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = async () => {
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(track => track.stop()); audioStreamRef.current = null; }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsLoading(true); setChatStatusText("Transcribing..."); setIsRecording(false);
        if (audioBlob.size === 0) {
            toast({title: "No audio."}); setIsLoading(false); setChatStatusText(documentOriginalName ? `Context: ${documentOriginalName.substring(0,20)}...` : "General Chat"); return;
        }
        const formData = new FormData(); formData.append('audio', audioBlob, 'user_audio.webm');
        try {
            if (!user.token) throw new Error("Auth token missing.");
            const result = await transcribeAudioAction(user.token, formData);
            if (result.text) setInputValue(prev => (prev ? prev + " " : "") + result.text);
            else if (result.error) throw new Error(result.error);
        } catch (transErr: any) { toast({title: "Transcription Failed", description: transErr.message, variant: "destructive"});
        } finally { setIsLoading(false); setChatStatusText(documentOriginalName ? `Context: ${documentOriginalName.substring(0,20)}...` : "General Chat"); }
      };
      mediaRecorderRef.current.start(); setIsRecording(true); setChatStatusText("Recording...");
    } catch (err: any) {
      toast({title: "Mic Error", description: err.message, variant: "destructive"});
      if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(track => track.stop()); audioStreamRef.current = null; }
      setIsRecording(false); mediaRecorderRef.current = null;
      setChatStatusText(documentOriginalName ? `Context: ${documentOriginalName.substring(0,20)}...` : "General Chat");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    else { // Failsafe cleanup
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(track => track.stop()); audioStreamRef.current = null; }
        setIsRecording(false); mediaRecorderRef.current = null;
        setChatStatusText(documentOriginalName ? `Context: ${documentOriginalName.substring(0,20)}...` : "General Chat");
    }
  };

  return (
    <Card className="h-full flex flex-col glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border shadow-xl rounded-lg">
      <CardHeader className="pb-2 border-b border-ai-engineer-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl font-headline text-ai-engineer-text-primary">
            <MessageSquare className="mr-2 h-6 w-6 text-ai-engineer-accent-blue" />
            AI Chat Tutor
            {currentThreadId && <span className="ml-2 text-xs text-ai-engineer-text-muted">(Thread: {currentThreadId.substring(0,8)}...)</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewChat} title="Start new chat" disabled={!user.token || isLoading} className="border-ai-engineer-accent-blue text-ai-engineer-accent-blue hover:bg-ai-engineer-accent-blue/10">
              <Files className="mr-1 h-4 w-4" /> New Chat
            </Button>
            <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleShowSessions} title="Previous sessions" disabled={!user.token || isLoading} className="border-ai-engineer-accent-teal text-ai-engineer-accent-teal hover:bg-ai-engineer-accent-teal/10">
                  <History className="mr-1 h-4 w-4" /> Sessions
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md md:max-w-lg glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border text-ai-engineer-text-primary">
                <DialogHeader>
                  <DialogTitle className="text-ai-engineer-accent-teal">Previous Chat Sessions</DialogTitle>
                  <DialogDescription className="text-ai-engineer-text-secondary">Load, rename, or delete sessions.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2 scrollbar-thin">
                  {isLoadingThreads ? <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-ai-engineer-accent-teal" /></div> : 
                   availableThreads.length > 0 ? availableThreads.map((thread) => (
                    <div key={thread.thread_id} className="flex items-center justify-between p-2 rounded hover:bg-ai-engineer-input-bg/50">
                      {threadToRename?.thread_id === thread.thread_id ? (
                         <div className="flex-grow flex items-center gap-1">
                             <Input defaultValue={thread.title} onChange={(e) => setNewThreadTitle(e.target.value)} className="h-8 text-sm flex-grow bg-ai-engineer-input-bg" autoFocus onKeyDown={(e) => {if(e.key === 'Enter') handleRenameThread()}}/>
                             <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleRenameThread} title="Save"><Check className="h-4 w-4 text-green-500"/></Button>
                             <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setThreadToRename(null)} title="Cancel"><XCircle className="h-4 w-4 text-red-500"/></Button>
                         </div>
                      ) : ( <>
                          <Button variant="ghost" className="flex-grow justify-start text-left h-auto py-1 px-2" onClick={() => loadChatHistory(thread.thread_id)}>
                              <div className="flex flex-col"><span className="font-medium text-sm truncate max-w-[180px] sm:max-w-[230px] md:max-w-[280px]">{thread.title || `Thread ${thread.thread_id.substring(0,8)}`}</span><span className="text-xs text-ai-engineer-text-muted">Updated: {new Date(thread.last_updated).toLocaleString()}</span></div>
                          </Button>
                          <div className="flex items-center gap-0.5 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Rename" onClick={() => {setThreadToRename(thread); setNewThreadTitle(thread.title);}}><Edit3 size={14} className="text-ai-engineer-text-secondary"/></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => setThreadToDelete(thread)}><Trash2 size={14} className="text-destructive"/></Button>
                          </div></>)
                      }</div>
                  )) : <p className="text-ai-engineer-text-muted text-center py-4">No sessions.</p>}
                </div>
                <DialogFooter><DialogClose asChild><Button type="button" variant="outline" className="border-ai-engineer-border hover:bg-ai-engineer-border">Close</Button></DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0 flex flex-col">
        <ScrollArea className="flex-grow p-4 scrollbar-thin" ref={scrollAreaRef}>
          {messages.map((msg) => (<ChatMessage key={msg.id} message={msg} onEdit={handleEditMessage} onCopy={handleCopyMessage} onFeedback={handleFeedback} />))}
          {isLoading && messages.every(m => !m.isLoading) && /* Show general thinking if no message is actively streaming */
             <div className="flex items-center justify-start my-4 ml-11"><Loader2 className="h-5 w-5 text-ai-engineer-accent-blue animate-spin mr-2" /><p className="text-sm text-ai-engineer-text-muted p-2 bg-ai-engineer-message-bot rounded-lg">AI is thinking...</p></div>
          }
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t border-ai-engineer-border/50 flex-col space-y-1.5">
        <p className="text-xs text-ai-engineer-text-muted w-full text-center">{chatStatusText}</p>
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Button variant="outline" size="icon" type="button" onClick={isRecording ? stopRecording : startRecording} disabled={isLoading || !isMediaRecorderSupported || !user.token} title={!user.token ? "Login for voice" : (isMediaRecorderSupported ? (isRecording ? "Stop" : "Record") : "Voice N/A")} className={isRecording ? "text-destructive border-destructive animate-pulse" : "border-ai-engineer-border hover:bg-ai-engineer-border"}> <Mic className="h-4 w-4" /> </Button>
          <Input type="text" placeholder={documentOriginalName ? `Ask about ${documentOriginalName.substring(0,20)}...` : "Ask a general question..."} value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="flex-1 bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted" disabled={isLoading || !user.token || isRecording} onKeyDown={(e) => {if(e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); handleSendMessage();}}}/>
          <Button variant="outline" size="icon" type="button" disabled={!isLoading || isRecording} onClick={handleStopStream} title="Stop AI Response" className="border-ai-engineer-border hover:bg-ai-engineer-border"> <StopCircle className="h-4 w-4" /> </Button>
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !user.token || isRecording} className="bg-ai-engineer-accent-blue hover:bg-ai-engineer-accent-blue/90 text-primary-foreground btn-glow-primary-hover"> {isLoading && !isRecording ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />} </Button>
        </form>
      </CardFooter>
      {threadToDelete && (
        <AlertDialog open={!!threadToDelete} onOpenChange={(open) => !open && setThreadToDelete(null)}>
            <AlertDialogContent className="glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border text-ai-engineer-text-primary">
            <AlertDHeader><AlertDTitle className="text-ai-engineer-accent-blue">Confirm Delete Session</AlertDTitle><AlertDialogDescription className="text-ai-engineer-text-secondary">Delete "{threadToDelete.title || `Session ${threadToDelete.thread_id.substring(0,8)}`}"? This cannot be undone.</AlertDialogDescription></AlertDHeader>
            <AlertDFooter><AlertDialogCancel className="bg-muted text-muted-foreground hover:bg-muted/80">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteThread} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
};

export default ChatTutorSection;
