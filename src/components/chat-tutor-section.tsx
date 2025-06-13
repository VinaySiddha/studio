
'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType, type Reference } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2, Mic, StopCircle, Files, History, XCircle, Edit3, Trash2, Check } from 'lucide-react';
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
  documentName: string | null; // This will be the SECURED name for API calls or null for general chat
  user: User;
  onClearDocumentContext: () => void;
}

interface Thread {
  thread_id: string;
  title: string;
  last_updated: string; 
}

const GENERAL_QUERY_PLACEHOLDER = "No document provided for context.";

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentName, user, onClearDocumentContext }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [chatStatusText, setChatStatusText] = useState("Initializing...");
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null);

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

  const fetchThreads = useCallback(async (showToastOnEmpty = false) => {
    if (!user.token) return;
    setIsLoadingThreads(true);
    try {
      const result = await listChatThreadsAction(user.token);
      if (result.error) throw new Error(result.error);
      const sortedThreads = result.threads?.sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()) || [];
      setAvailableThreads(sortedThreads);
      if (showToastOnEmpty && sortedThreads.length === 0) {
        toast({ title: "No Previous Sessions", description: "Start a new chat to create one." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Loading Sessions", description: error.message });
      setAvailableThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [user.token, toast]);

  useEffect(() => {
    const storedThreadId = localStorage.getItem('aiTutorThreadId');
    if (storedThreadId) {
      setCurrentThreadId(storedThreadId);
      if (user.token) loadChatHistory(storedThreadId);
    } else {
      setMessages([{
        id: 'initial-bot-message',
        sender: 'ai',
        text: documentName ? `Ask me anything about the selected document!` : "Upload or select a document to chat about, or ask a general question.",
        timestamp: new Date(),
      }]);
    }
    // This effect updates status text based on documentName (which reflects chat mode)
    const displayDocName = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
    setChatStatusText(displayDocName ? `Chatting about: ${displayDocName}` : "General Chat Mode");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentName, user.token]); // Only re-run if documentName (context) or user token changes

  // Separate useEffect for scrolling, depends only on messages and thinkingMessage
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
      setChatStatusText("Response stopped by user.");
      setMessages((prev) => prev.map(m => m.isLoading ? {...m, text: m.text === '...' ? "[Response stopped by user]" : m.text + "\n[Response stopped by user]", isLoading: false} : m));
    }
  };

  // To be called by AppContent when selectedDoc is cleared.
  const resetToGeneralChat = useCallback(() => {
        setMessages([{
            id: 'general-chat-prompt',
            sender: 'ai',
            text: "Switched to General Chat Mode. How can I help you?",
            timestamp: new Date(),
        }]);
        const displayDocName = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
        setChatStatusText(displayDocName ? `Chatting about: ${displayDocName}` : "General Chat Mode");
  }, [documentName]); // documentName dependency to update status text correctly

  useEffect(() => {
    if (!documentName && currentThreadId) { // If document context is cleared but a thread exists
        // Potentially fetch general history or just show a general prompt
        // For now, let's assume onClearDocumentContext in AppContent handles resetting messages if needed
        // Or, ChatTutorSection itself can reset to a general welcome for the current thread
        // resetToGeneralChat(); // This might be too aggressive, let AppContent manage message reset
    }
    const displayDocName = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
    setChatStatusText(displayDocName ? `Chatting about: ${displayDocName}` : "General Chat Mode");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentName, resetToGeneralChat]);


  // Dummy uploadedDocs state for status text until AppContent provides it
  const [uploadedDocs, setUploadedDocs] = useState<{name: string, securedName: string}[]>([]);
   useEffect(() => {
    // In a real app, this would be fetched or passed as a prop
    // For placeholder:
    // setUploadedDocs([{name: "Sample Doc 1", securedName: "sample1_sec"}, {name: "Another PDF", securedName: "another_sec"}]);
  }, []);


  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;
    
    // API Key Check: Rely on server-side Genkit configuration.
    // Client-side check for localStorage key is for UI feedback only.
    if (!localStorage.getItem('userGoogleApiKey')) {
        toast({
            variant: "destructive",
            title: "API Key Not Set",
            description: "Please set your Google API Key in the 'API Key Manager' section before chatting with Gemini. This is a reminder to also set the server-side environment variable.",
            duration: 7000,
        });
        // Optionally, do not proceed if you want to enforce this UI step.
        // For now, we'll let it proceed, as the server-side env var is the critical one.
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
    const displayDocNameLoading = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
    setChatStatusText(displayDocNameLoading ? `AI thinking about ${displayDocNameLoading}...` : "AI Tutor is thinking...");
    setThinkingMessage("AI is preparing your response...");

    abortControllerRef.current = new AbortController();
    const currentAiMessageId = Date.now().toString() + '-ai-stream'; 
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
        documentContent: documentName || GENERAL_QUERY_PLACEHOLDER, 
        threadId: currentThreadId || undefined,
        // No authToken here, /api/chat with Genkit doesn't need it for this specific purpose
      };

      const response = await fetch('/api/chat', {
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
            const rawData = sseMessage.substring(6);
            if (!rawData.trim()) continue; 
            
            let data;
            try {
              data = JSON.parse(rawData);
            } catch (parseError: any) {
              console.error('[ChatTutor] Error parsing SSE JSON:', parseError.message, "Raw SSE part:", rawData);
              currentAiMessageText += `\n[Error processing response stream: malformed JSON chunk]`;
               setMessages(prev => prev.map(m =>
                m.id === currentAiMessageId ? {
                  ...m, text: currentAiMessageText, isError: true, isLoading: false 
                } : m));
              continue; 
            }
            if (typeof data !== 'object' || data === null) {
              console.warn("[ChatTutor] Received non-object or null SSE data from stream:", data);
              currentAiMessageText += `\n[Error processing response stream: unexpected data format]`;
               setMessages(prev => prev.map(m =>
                m.id === currentAiMessageId ? {
                  ...m, text: currentAiMessageText, isError: true, isLoading: false 
                } : m));
              continue;
            }

            if (data.type === 'thinking' && typeof data.message === 'string') {
              setThinkingMessage(data.message);
            } else if (data.type === 'chunk' && typeof data.content === 'string') {
              currentAiMessageText += data.content;
              setMessages((prev) => prev.map(msg =>
                msg.id === currentAiMessageId ? { ...msg, text: currentAiMessageText, isLoading: true } : msg
              ));
            } else if (data.type === 'final') {
              currentAiMessageText = (data.answer && typeof data.answer === 'string' ? data.answer : currentAiMessageText) || "";
              // The threadId update logic (if Genkit sends it back)
              const finalThreadId = (data.threadId && typeof data.threadId === 'string' ? data.threadId : null) || currentThreadId;
              if (finalThreadId && finalThreadId !== currentThreadId) {
                setCurrentThreadId(finalThreadId);
                localStorage.setItem('aiTutorThreadId', finalThreadId);
              }
              setMessages((prev) => prev.map(msg =>
                msg.id === currentAiMessageId ? {
                  ...msg,
                  text: currentAiMessageText || "[AI response complete]",
                  references: (data.references && Array.isArray(data.references)) ? data.references as Reference[] : [],
                  thinking: (data.thinking && typeof data.thinking === 'string') ? data.thinking : undefined,
                  isLoading: false
                } : msg
              ));
            } else if (data.type === 'error') {
              const errorMessageContent = (data.error && typeof data.error === 'string') ? data.error : ((data.message && typeof data.message === 'string') ? data.message : 'Stream error from server.');
              currentAiMessageText += `\n[Error from AI: ${errorMessageContent}]`;
               setMessages(prev => prev.map(m =>
                m.id === currentAiMessageId ? {
                  ...m, text: currentAiMessageText, isError: true, isLoading: false
                } : m));
            } else {
              console.warn("[ChatTutor] Received SSE data with unknown type or structure from stream:", data);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
         setMessages(prev => prev.map(m => m.id === currentAiMessageId && m.isLoading ? {...m, text: (m.text === "..." ? "" : m.text) + "[Response stopped by user]", isLoading: false} : m));
      } else {
        console.error('Error fetching AI response:', error);
        const errorMessage = String(error.message || 'Unknown chat error');
        currentAiMessageText += `\n[Error: ${errorMessage}]`;
        setMessages((prev) => prev.map(msg =>
          msg.id === currentAiMessageId ? {
            ...msg,
            text: currentAiMessageText || `Sorry, I encountered an error: ${errorMessage}`,
            isError: true,
            isLoading: false
          } : msg
        ));
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setThinkingMessage(null);
      setMessages(prev => prev.map(m => 
        m.id === currentAiMessageId && m.isLoading ? {...m, isLoading: false, text: m.text === "..." ? "[Response incomplete or error]" : m.text } : m
      ));
      const displayDocNameFinally = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
      setChatStatusText(displayDocNameFinally ? `Chatting about: ${displayDocNameFinally}` : "General Chat Mode");
    }
  };

  const handleEditMessage = (messageId: string, newText: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, text: newText, isEdited: true, timestamp: new Date() } : m));
    toast({ title: "Message Updated", description: "Your message text has been updated in the chat display. This does not resend to the AI." });
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied to clipboard!" }))
      .catch(() => toast({ variant: "destructive", title: "Failed to copy." }));
  };

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m => m.id === messageId ? {...m, feedback: m.feedback === feedbackType ? undefined : feedbackType } : m));
    toast({ title: `Feedback: ${feedbackType}` });
  };

  const handleNewChat = async () => {
    setIsLoading(true);
    setChatStatusText("Starting new chat...");
    onClearDocumentContext(); // This will trigger documentName prop to become null
    try {
      // Now using Genkit, thread creation might be implicit or handled differently by /api/chat.
      // For now, let's just clear client-side state for a "new chat" feel.
      // If Genkit flow needs explicit thread creation, /api/chat should handle it.
      const newThreadId = `genkit-thread-${Date.now()}`; // Simulate a new thread ID client-side for now
      setCurrentThreadId(newThreadId);
      localStorage.setItem('aiTutorThreadId', newThreadId);
      setMessages([{
        id: 'new-chat-initial-msg-' + newThreadId,
        sender: 'ai',
        text: "New chat session started with Gemini. How can I help you?",
        timestamp: new Date(),
      }]);
      // Status text will be updated by useEffect based on documentName prop
      toast({ title: "New Chat Started (Gemini)" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "New Chat Error", description: error.message });
      setChatStatusText("Error starting new chat.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowSessions = async () => {
    if (!user.token) { // Auth token might not be needed for Genkit sessions if not implemented
      // toast({ variant: "destructive", title: "Error", description: "Login to view sessions." });
      // return;
    }
    setIsLoadingThreads(true);
    setIsSessionsDialogOpen(true);
    // Fetching threads might change if Genkit handles session history differently
    // For now, assume listChatThreadsAction is still relevant or adapt as needed
    await fetchThreads(true); 
  };

  const loadChatHistory = async (threadIdToLoad: string) => {
    // This function may need to be adapted if chat history is managed by Genkit/Gemini differently
    // For now, assuming it still loads from a source compatible with listChatThreadsAction
    if (!user.token) { 
      // toast({ variant: "destructive", title: "Authentication Error", description: "Cannot load history." });
      // return;
    }
    setIsLoading(true);
    const displayDocNameLoadingHist = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
    setChatStatusText(displayDocNameLoadingHist ? `Loading history for ${displayDocNameLoadingHist}... (Thread: ${threadIdToLoad.substring(0,8)})` : `Loading history for thread ${threadIdToLoad.substring(0,8)}...`);
    setMessages([]);
    // onClearDocumentContext(); // Do not clear document context when loading history for that context
    try {
      const result = await getThreadHistoryAction(user.token, threadIdToLoad);
      if (result.error) throw new Error(result.error);

      const fetchedMessages: MessageType[] = (result.messages || []).map((msg: any) => ({
        id: msg.message_id || msg._id || String(Date.now() + Math.random()),
        sender: msg.sender,
        text: msg.message_text,
        timestamp: new Date(msg.timestamp),
        references: (msg.references && Array.isArray(msg.references)) ? msg.references : (msg.references_json ? JSON.parse(msg.references_json) : []),
        thinking: msg.thinking || msg.cot_reasoning,
        isEdited: msg.is_edited,
        isError: msg.is_error,
      }));

      setMessages(fetchedMessages);
      setCurrentThreadId(threadIdToLoad);
      localStorage.setItem('aiTutorThreadId', threadIdToLoad);
      const displayDocNameLoadedHist = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
      setChatStatusText(displayDocNameLoadedHist ? `Chatting about: ${displayDocNameLoadedHist} (Thread: ${threadIdToLoad.substring(0,8)})` : `General Chat Mode (Thread: ${threadIdToLoad.substring(0,8)}...)`);
      if (fetchedMessages.length === 0) {
          toast({ title: "Empty Thread", description: "This chat session has no messages yet." });
          setMessages([{id: 'empty-thread-msg', sender: 'ai', text: "This chat is empty. Ask something!", timestamp: new Date()}]);
      } else {
        toast({ title: "Chat History Loaded", description: `Loaded session ${threadIdToLoad.substring(0,8)}...`});
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

  const handleRenameThread = async () => {
    if (!threadToRename || !newThreadTitle.trim() || !user.token) return;
    const oldTitle = threadToRename.title;
    const threadIdToUpdate = threadToRename.thread_id;

    toast({ title: `Renaming thread to "${newThreadTitle}"...` });
    try {
      const result = await renameChatThreadAction(user.token, threadIdToUpdate, newThreadTitle.trim());
      if (result.success) {
        toast({ title: "Thread Renamed", description: `"${oldTitle}" is now "${newThreadTitle}".` });
        await fetchThreads();
      } else {
        throw new Error(result.error || "Failed to rename thread.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Rename Failed", description: error.message });
    }
    setThreadToRename(null);
    setNewThreadTitle("");
  };

  const handleDeleteThread = async () => {
    if (!threadToDelete || !user.token) return;
    const titleToDelete = threadToDelete.title;
    const idToDelete = threadToDelete.thread_id;

    toast({ title: `Deleting thread "${titleToDelete}"...` });
    try {
      const result = await deleteChatThreadAction(user.token, idToDelete);
      if (result.success) {
        toast({ title: "Thread Deleted", description: `"${titleToDelete}" has been deleted.` });
        if (currentThreadId === idToDelete) {
          setCurrentThreadId(null);
          localStorage.removeItem('aiTutorThreadId');
          setMessages([{id: 'deleted-thread-msg', sender: 'ai', text: "Current chat session was deleted. Start a new one or load another.", timestamp: new Date()}]);
          onClearDocumentContext(); 
        }
        await fetchThreads(); 
      } else {
        throw new Error(result.error || "Failed to delete thread.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
    }
    setThreadToDelete(null);
  };

  const startRecording = async () => {
    if (!isMediaRecorderSupported) { // Removed user.token check as Genkit handles auth via env var for Gemini
      toast({title: "Voice input not available or not logged in.", variant: "destructive"});
      return;
    }
    try {
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
        
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        // mediaRecorderRef.current = null; // This might be premature if onstop is re-entrant or error occurs later

        setIsLoading(true); 
        setChatStatusText("Transcribing audio...");
        
        if (audioBlob.size === 0) {
            toast({title: "No audio recorded.", variant: "default"});
            setIsLoading(false);
            setIsRecording(false);
            const displayDocNameRec = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
            setChatStatusText(displayDocNameRec ? `Chatting about: ${displayDocNameRec}` : "General Chat Mode");
            return;
        }
        
        toast({title: "Transcribing audio..."});
        const formData = new FormData();
        formData.append('audio', audioBlob, 'user_audio.webm');

        try {
            // Transcription might now be a Genkit flow or still a Flask endpoint.
            // Assuming transcribeAudioAction is updated or replaced if needed.
            // For now, user.token is still passed, assuming Flask endpoint for transcription.
            if (!user.token) throw new Error("User token not found for transcription if using Flask for transcription.");
            const result = await transcribeAudioAction(user.token, formData);

            if (result.text) {
                setInputValue(prev => (prev ? prev + " " : "") + result.text);
                toast({title: "Transcription complete."});
            } else if (result.error) {
                throw new Error(result.error);
            } else {
                toast({title: "Empty transcription received.", variant: "default"});
            }
        } catch (transcriptionError: any) {
            toast({title: "Transcription Failed", description: transcriptionError.message, variant: "destructive"});
        } finally {
            setIsLoading(false);
            setIsRecording(false); // Ensure this is set here
            mediaRecorderRef.current = null; // Also clear here
            const displayDocNameRecFin = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
            setChatStatusText(displayDocNameRecFin ? `Chatting about: ${displayDocNameRecFin}` : "General Chat Mode");
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setChatStatusText("Recording audio...");
    } catch (err: any) {
      console.error("Error starting recording:", err);
      toast({title: "Microphone Error", description: `Could not access microphone: ${err.message}`, variant: "destructive"});
      if (audioStreamRef.current) { 
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      setIsRecording(false); // Reset recording state on error
      mediaRecorderRef.current = null; // Clear recorder instance on error
      const displayDocNameRecErr = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
      setChatStatusText(displayDocNameRecErr ? `Chatting about: ${displayDocNameRecErr}` : "General Chat Mode");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // onstop will handle setting isRecording to false and other UI updates
    } else { // If somehow isRecording is false but stream/recorder exists
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
        }
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current = null;
        }
        setIsRecording(false);
        const displayDocNameStopRec = documentName ? (uploadedDocs.find(d => d.securedName === documentName)?.name || documentName.substring(0,20) + "...") : null;
        setChatStatusText(displayDocNameStopRec ? `Chatting about: ${displayDocNameStopRec}` : "General Chat Mode");
    }
  };

  return (
    <Card className="h-full flex flex-col glass-panel rounded-lg shadow-xl">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl font-headline">
            <MessageSquare className="mr-2 h-6 w-6 text-primary" />
            Chat with Gemini
            {currentThreadId && <span className="ml-2 text-xs text-muted-foreground">(Thread: {currentThreadId.substring(0,8)}...)</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewChat} title="Start a new chat session" disabled={isLoading}>
              <Files className="mr-1 h-4 w-4" /> New Chat
            </Button>
            <Dialog open={isSessionsDialogOpen} onOpenChange={setIsSessionsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleShowSessions} title="View previous chat sessions" disabled={isLoading}>
                  <History className="mr-1 h-4 w-4" /> Sessions
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md md:max-w-lg lg:max-w-xl glass-panel">
                <DialogHeader>
                  <DialogTitle>Previous Chat Sessions</DialogTitle>
                  <DialogDescription>Select a session to load its history. You can also rename or delete sessions.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                  {isLoadingThreads ? (
                    <div className="flex justify-center items-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2">Loading sessions...</span>
                    </div>
                  ) : availableThreads.length > 0 ? (
                    availableThreads.map((thread) => (
                      <div key={thread.thread_id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        {threadToRename?.thread_id === thread.thread_id ? (
                           <div className="flex-grow flex items-center gap-2">
                               <Input
                                 defaultValue={thread.title}
                                 onChange={(e) => setNewThreadTitle(e.target.value)}
                                 className="h-8 text-sm flex-grow"
                                 autoFocus
                                 onKeyDown={(e) => {if(e.key === 'Enter') handleRenameThread()}}
                                />
                               <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 shrink-0" onClick={handleRenameThread} title="Confirm Rename"><Check className="h-4 w-4"/></Button>
                               <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 shrink-0" onClick={() => setThreadToRename(null)} title="Cancel Rename"><XCircle className="h-4 w-4"/></Button>
                           </div>
                        ) : (
                          <>
                            <Button
                                variant="ghost"
                                className="flex-grow justify-start text-left h-auto py-1 px-2"
                                onClick={() => loadChatHistory(thread.thread_id)}
                            >
                                <div className="flex flex-col">
                                <span className="font-medium text-sm truncate max-w-[200px] sm:max-w-[250px] md:max-w-[300px]">{thread.title || `Session ${thread.thread_id.substring(0,8)}`}</span>
                                <span className="text-xs text-muted-foreground">
                                    Updated: {new Date(thread.last_updated).toLocaleString()}
                                </span>
                                </div>
                            </Button>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Rename" onClick={() => {setThreadToRename(thread); setNewThreadTitle(thread.title);}}>
                                    <Edit3 size={14} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setThreadToDelete(thread)}>
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
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
      <CardContent className="flex-grow overflow-hidden p-0 flex flex-col">
        <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
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
             <div className="flex items-center justify-start my-4 ml-11"> 
                <Loader2 className="h-5 w-5 text-primary animate-spin mr-2" />
                <p className="text-sm text-muted-foreground p-3 bg-muted/70 rounded-lg shadow-md glass-panel !bg-card/50">{thinkingMessage}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t border-border/50 flex-col space-y-2">
        <p className="text-xs text-muted-foreground w-full text-center">{chatStatusText}</p>
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || !isMediaRecorderSupported} // Removed user.token check
            title={isMediaRecorderSupported ? (isRecording ? "Stop Recording" : "Start Voice Input") : "Voice input not supported"}
            className={isRecording ? "text-destructive border-destructive animate-pulse" : ""}
          >
            <Mic className="h-4 w-4" /> <span className="sr-only">Voice Input</span>
          </Button>
          <Input
            type="text"
            placeholder={documentName ? `Ask Gemini about ${uploadedDocs.find(d => d.securedName === documentName)?.name || "the document"}...` : "Ask Gemini a general question..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            disabled={isLoading || isRecording} 
          />
          <Button variant="outline" size="icon" type="button" disabled={!isLoading || abortControllerRef.current === null || isRecording} onClick={handleStopStream} title="Stop AI Response">
            <StopCircle className="h-4 w-4" /> <span className="sr-only">Stop</span>
          </Button>
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || isRecording} className="btn-glow-primary-hover">
            {isLoading && !isRecording ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>

      {threadToDelete && (
        <AlertDialog open={!!threadToDelete} onOpenChange={(open) => !open && setThreadToDelete(null)}>
            <AlertDialogContent className="glass-panel">
            <AlertDHeader>
                <AlertDTitle>Confirm Delete Session</AlertDTitle>
                <AlertDialogDescription>
                Are you sure you want to delete the chat session "{threadToDelete.title || `Session ${threadToDelete.thread_id.substring(0,8)}`}"? This action cannot be undone.
                </AlertDialogDescription>
            </AlertDHeader>
            <AlertDFooter>
                <AlertDialogCancel onClick={() => setThreadToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteThread} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
                </AlertDialogAction>
            </AlertDFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
};

export default ChatTutorSection;
