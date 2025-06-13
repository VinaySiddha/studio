
'use client';

import { useState, type FC, useEffect, useCallback, useRef } from 'react';
import DocumentUploadSection from '@/components/document-upload-section';
import DocumentUtilitiesSection from '@/components/document-utilities-section';
import ChatTutorSection from '@/components/chat-tutor-section';
import HelpTooltip from '@/components/help-tooltip';
import ApiKeyManager from '@/components/api-key-manager'; // Import new component
import { useToast } from "@/hooks/use-toast";
import { 
  generateFaq, 
  generateTopics, 
  generateMindMap, 
  generatePodcastScript,
  listDocumentsAction, 
  handleDocumentUploadAction,
  deleteDocumentAction
} from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { User } from '@/app/page';
import { Button } from '@/components/ui/button';
import { MessageCircle, BookOpen, ServerCrash, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export interface DocumentFile {
  name: string; 
  securedName: string; 
}

export type UtilityAction = 'faq' | 'topics' | 'mindmap' | 'podcast';
export type ChatMode = 'general' | 'document';

interface CachedUtilityResult {
  title: string;
  content: string;
  raw?: any;
  action?: UtilityAction;
  error?: string;
  isProcessingError?: boolean;
}

interface UtilityCache {
  [docSecuredName: string]: {
    [action in UtilityAction]?: CachedUtilityResult;
  };
}

interface AppContentProps {
  user: User;
}

const AppContent: FC<AppContentProps> = ({ user }) => {
  const [uploadedDocs, setUploadedDocs] = useState<DocumentFile[]>([]);
  const [selectedDocSecuredName, setSelectedDocSecuredName] = useState<string | null>(null);
  const [selectedDocOriginalName, setSelectedDocOriginalName] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>("Select a document to upload.");
  
  const [utilityResult, setUtilityResult] = useState<CachedUtilityResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingUtility, setIsLoadingUtility] = useState<Record<UtilityAction, boolean>>({
    faq: false,
    topics: false,
    mindmap: false,
    podcast: false,
  });
  const [analysisStatusText, setAnalysisStatusText] = useState<string>("Select document & utility type.");
  const [chatMode, setChatMode] = useState<ChatMode>('general');
  const [docToDelete, setDocToDelete] = useState<DocumentFile | null>(null);
  const [utilityCache, setUtilityCache] = useState<UtilityCache>({});
  const mindMapContainerRef = useRef<HTMLDivElement>(null);
  const [isMindmapRendering, setIsMindmapRendering] = useState(false);

  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    if (user?.token) {
      setAnalysisStatusText("Loading documents...");
      try {
        const result = await listDocumentsAction(user.token);
        if (result.error) {
          toast({ variant: "destructive", title: "Failed to load documents", description: result.error });
          setAnalysisStatusText(`Error: ${result.error}`);
          setUploadedDocs([]);
        } else {
          const docs: DocumentFile[] = (result.uploaded_files || []).map(f => ({ 
            name: f.name, // Expecting original_filename as 'name' from backend
            securedName: f.securedName // Expecting secured (UUID) filename as 'securedName'
          }));
          setUploadedDocs(docs);

          if (docs.length === 0) {
            setAnalysisStatusText("No documents uploaded. Upload a file to begin.");
            setSelectedDocSecuredName(null);
            setSelectedDocOriginalName(null);
            if (chatMode === 'document') setChatMode('general');
          } else {
            const currentSelectedExists = selectedDocSecuredName ? docs.some(d => d.securedName === selectedDocSecuredName) : false;
            if (currentSelectedExists && selectedDocOriginalName) {
                 setAnalysisStatusText(`Selected: ${selectedDocOriginalName}. Ready for utilities or document chat.`);
            } else {
                 if (selectedDocSecuredName && !currentSelectedExists) {
                    setSelectedDocSecuredName(null); 
                    setSelectedDocOriginalName(null);
                    if (chatMode === 'document') setChatMode('general'); 
                 }
                 setAnalysisStatusText("Select a document for utilities or document-specific chat.");
            }
          }
        }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error fetching documents", description: e.message });
        setAnalysisStatusText(`Error: ${e.message}`);
      }
    }
  }, [user.token, toast, selectedDocSecuredName, selectedDocOriginalName, chatMode]); 

  useEffect(() => {
    fetchDocuments();
  }, [user.token, fetchDocuments]);


  const handleDocumentUpload = async (file: File) => {
    if (!user?.token) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to upload." });
      return;
    }
    setIsUploading(true);
    setUploadStatusText(`Uploading ${file.name}...`);
    toast({ title: "Uploading Document", description: `Sending ${file.name}...` });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await handleDocumentUploadAction(formData, user.token);
      if (result.error || !result.filename || !result.original_filename) {
        throw new Error(result.error || "Upload failed: Missing file information from server.");
      }
      
      setUploadStatusText(`Successfully uploaded ${result.original_filename}.`);
      toast({ title: "Document Uploaded", description: `${result.original_filename} processed. KB: ${result.vector_count ?? 'N/A'}` });
      
      await fetchDocuments(); 

      setSelectedDocSecuredName(result.filename); 
      setSelectedDocOriginalName(result.original_filename);
      setChatMode('document'); 
      setAnalysisStatusText(`Selected: ${result.original_filename}. Ready for utilities or document chat.`);
      
    } catch (error: any) {
      console.error("File upload error:", error);
      setUploadStatusText(`Error uploading ${file.name}: ${error.message}`);
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSelectDocument = (securedNameToSelect: string) => {
    const selected = uploadedDocs.find(d => d.securedName === securedNameToSelect);
    if (selected) {
      setSelectedDocSecuredName(selected.securedName);
      setSelectedDocOriginalName(selected.name);
      setChatMode('document'); 
      setAnalysisStatusText(`Selected: ${selected.name}. Ready for utilities or document chat.`);
      toast({ title: "Document Selected", description: `${selected.name} is now active for utilities and document-specific chat.` });
    } else {
      setSelectedDocSecuredName(null);
      setSelectedDocOriginalName(null);
      if (securedNameToSelect === "" || securedNameToSelect === null || securedNameToSelect === "no-doc-placeholder") { 
        setChatMode('general');
        setAnalysisStatusText("Document deselected. Switched to general chat mode.");
        toast({variant: "default", title: "Document Deselected", description: "Switched to general chat mode."})
      } else {
        setChatMode('general');
        setAnalysisStatusText("Document not found. Switched to general chat mode.");
        toast({variant: "warning", title: "Document Not Found", description: "Switched to general chat mode."})
      }
    }
  };

  const handleToggleChatMode = () => {
    if (chatMode === 'general') {
      if (selectedDocSecuredName && selectedDocOriginalName) {
        setChatMode('document');
        toast({ title: "Chat Mode Switched", description: `Now chatting about ${selectedDocOriginalName}.` });
      } else {
        toast({ variant: "default", title: "Select Document for Document Chat", description: "Please select a document from the 'Document Hub' first to switch to document-specific chat mode." });
      }
    } else { 
      setChatMode('general');
      toast({ title: "Chat Mode Switched", description: "Now in general chat mode." });
    }
  };
  
  const handleConfirmDeleteDocument = async () => {
    if (!docToDelete || !user.token) return;
    const docNameForToast = docToDelete.name;
    const securedNameForDeletion = docToDelete.securedName;
    toast({ title: `Deleting ${docNameForToast}...` });
    try {
        const result = await deleteDocumentAction(user.token, securedNameForDeletion);
        if (result.success) {
          toast({ title: "Document Deleted", description: `${docNameForToast} has been deleted.` });
          
          setUploadedDocs(prevDocs => prevDocs.filter(d => d.securedName !== securedNameForDeletion));

          setUtilityCache(prevCache => {
            const newCache = {...prevCache};
            delete newCache[securedNameForDeletion];
            return newCache;
          });

          if (selectedDocSecuredName === securedNameForDeletion) {
            setSelectedDocSecuredName(null);
            setSelectedDocOriginalName(null);
            setChatMode('general'); 
            setAnalysisStatusText(uploadedDocs.length > 1 ? "Document deleted. Select another or upload." : "Document deleted. Upload a new document.");
          } else if (uploadedDocs.length <= 1) { 
            setChatMode('general');
            setAnalysisStatusText("All documents deleted. Upload a new document.");
          }
        } else {
          throw new Error(result.error || "Failed to delete document from server.");
        }
    } catch (error: any) {
         toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
    }
    setDocToDelete(null);
  };


  const handleUtilityAction = async (action: UtilityAction) => {
    if (!selectedDocSecuredName || !selectedDocOriginalName) {
      setAnalysisStatusText("Please select a document first.");
      toast({ variant: "destructive", title: "No Document Selected", description: "Please select a document for utilities." });
      return;
    }
    if (!user?.token) {
      toast({ variant: "destructive", title: "Authentication Error", description: "Action requires login." });
      return;
    }

    const cachedItem = utilityCache[selectedDocSecuredName]?.[action];
    if (cachedItem) {
      setUtilityResult(cachedItem);
      setIsModalOpen(true);
      if (cachedItem.action === 'mindmap' && cachedItem.content) {
        // Rendering is now handled by useEffect listening to isModalOpen and utilityResult
      }
      setAnalysisStatusText(`Showing cached ${action} for ${selectedDocOriginalName}.`);
      toast({ title: "Showing Cached Utility", description: `${action} for ${selectedDocOriginalName} loaded from cache.` });
      return;
    }

    setIsLoadingUtility(prev => ({ ...prev, [action]: true }));
    setAnalysisStatusText(`Requesting ${action} for ${selectedDocOriginalName}...`);
    toast({ title: "Processing Utility", description: `Generating ${action} for ${selectedDocOriginalName}...` });

    try {
      let resultData: any;
      const inputArgs = { documentName: selectedDocSecuredName, userToken: user.token }; 

      switch (action) {
        case 'faq': resultData = await generateFaq(inputArgs); break;
        case 'topics': resultData = await generateTopics(inputArgs); break;
        case 'mindmap': resultData = await generateMindMap(inputArgs); break;
        case 'podcast': resultData = await generatePodcastScript(inputArgs); break;
        default: throw new Error("Unknown utility action");
      }

      let displayContent = "";
      let isProcessingError = false;
      let currentUtilityResult: CachedUtilityResult;

      if (resultData.error) {
        const errorMsg = resultData.error;
         if (errorMsg.includes("Failed to retrieve or process text content") || errorMsg.includes("doc_text_for_llm is empty") || errorMsg.includes("not found") || errorMsg.includes("File Not Found")) {
          displayContent = `Could not perform '${action}' on "${selectedDocOriginalName}". The server failed to process this document's content. It might be corrupted, password-protected, or an unsupported format. Please try with a different document or check server logs.`;
          isProcessingError = true;
        } else {
          displayContent = `An error occurred while generating ${action}: ${errorMsg}`;
        }
        toast({ variant: "destructive", title: `Error Generating ${action}`, description: isProcessingError ? `Document processing failed for ${selectedDocOriginalName}.` : errorMsg, duration: 7000 });
        currentUtilityResult = {
          title: `Error - ${action} for ${selectedDocOriginalName}`,
          content: displayContent, raw: resultData, action, error: resultData.error, isProcessingError
        };
      } else {
          if (action === 'topics' && resultData.content) { // generateTopics now returns content (string) and topics (array)
            displayContent = resultData.content; // Use the string content for display
          } else if (action === 'podcast') {
            displayContent = resultData.script || resultData.podcastScript || "No script returned.";
          } else { 
            displayContent = resultData.content || resultData.faqList || resultData.mindMap || "No content returned.";
          }
          toast({ title: "Utility Generated", description: `${action} for ${selectedDocOriginalName} is ready.` });
          currentUtilityResult = {
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} for ${selectedDocOriginalName}`,
            content: displayContent, raw: resultData, action, error: undefined, isProcessingError: false,
          };
      }
      
      setUtilityCache(prevCache => ({
        ...prevCache,
        [selectedDocSecuredName]: { ...(prevCache[selectedDocSecuredName] || {}), [action]: currentUtilityResult, }
      }));

      setUtilityResult(currentUtilityResult);
      setIsModalOpen(true);
      // Mindmap rendering is handled by useEffect based on isModalOpen & utilityResult
      setAnalysisStatusText(resultData.error ? `Error generating ${action}.` : `${action} for ${selectedDocOriginalName} received.`);

    } catch (error: any) {
      console.error(`Error generating ${action} from server action:`, error);
      const errorMsg = error.message || "An unexpected error occurred.";
      setAnalysisStatusText(`Error generating ${action}: ${errorMsg}`);
      toast({ variant: "destructive", title: `Error Generating ${action}`, description: errorMsg, duration: 7000 });
      const errorResult: CachedUtilityResult = { 
        title: `Error - ${action} for ${selectedDocOriginalName}`, content: `Failed to generate ${action}. Error: ${errorMsg}`, 
        error: errorMsg, raw: { error: errorMsg }, action 
      };
      if(selectedDocSecuredName){
        setUtilityCache(prevCache => ({ ...prevCache, [selectedDocSecuredName]: { ...(prevCache[selectedDocSecuredName] || {}), [action]: errorResult, } }));
      }
      setUtilityResult(errorResult);
      setIsModalOpen(true);
    } finally {
      setIsLoadingUtility(prev => ({ ...prev, [action]: false }));
    }
  };

  const renderMindmap = async (mermaidCode: string) => {
    if (mindMapContainerRef.current && (window as any).mermaid) {
      setIsMindmapRendering(true);
      mindMapContainerRef.current.innerHTML = ''; 
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      
      let cleanedCode = mermaidCode.trim();
      if (cleanedCode.startsWith("```mermaid")) {
        cleanedCode = cleanedCode.substring("```mermaid".length).trim();
      }
      if (cleanedCode.endsWith("```")) {
        cleanedCode = cleanedCode.substring(0, cleanedCode.length - "```".length).trim();
      }
      if (!cleanedCode.toLowerCase().startsWith("mindmap")) {
          cleanedCode = "mindmap\n" + cleanedCode;
      }

      mermaidDiv.textContent = cleanedCode;
      mindMapContainerRef.current.appendChild(mermaidDiv);
      try {
        await (window as any).mermaid.run({ nodes: [mermaidDiv] });
      } catch (e: any) {
        console.error("Mermaid rendering error:", e);
        mindMapContainerRef.current.innerHTML = `<p class="text-destructive">Error rendering mind map: ${e.message || 'Unknown error'}.</p><p class="text-xs text-muted-foreground mt-2">Ensure the generated content is valid Mermaid mindmap syntax.</p><details class="mt-1"><summary class="text-xs cursor-pointer">Show Raw Code</summary><pre class="text-xs bg-muted/50 p-1 rounded whitespace-pre-wrap max-h-20 overflow-auto">${cleanedCode}</pre></details>`;
      } finally {
        setIsMindmapRendering(false);
      }
    } else {
      console.warn("Mermaid container or library not ready.");
      if(mindMapContainerRef.current) mindMapContainerRef.current.innerHTML = '<p class="text-warning">Mindmap rendering library not available or container error.</p>';
      setIsMindmapRendering(false);
    }
  };
  
  useEffect(() => {
    if (isModalOpen && utilityResult?.action === 'mindmap' && utilityResult.content && !utilityResult.error && !utilityResult.isProcessingError) {
      renderMindmap(utilityResult.content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, utilityResult]);


  const documentContextForChat = chatMode === 'document' ? selectedDocOriginalName : null;


  return (
    <div className="flex flex-col flex-grow h-full overflow-hidden">
      <ApiKeyManager />
      <div className="my-4 flex justify-center items-center gap-2">
        <Button 
            onClick={handleToggleChatMode} 
            variant="outline" 
            className="btn-glow-primary-hover shadow-md"
            disabled={chatMode === 'document' ? false : (!selectedDocSecuredName && uploadedDocs.length > 0)} 
            title={
              chatMode === 'general' 
                ? (selectedDocSecuredName ? "Switch to Document Chat" : "Select a document from 'Document Hub' to enable document-specific chat") 
                : "Switch to General Chat"
            }
          >
            {chatMode === 'general' ? <MessageCircle className="mr-2 h-5 w-5" /> : <BookOpen className="mr-2 h-5 w-5 text-primary" />}
            {chatMode === 'general' ? 'General Chat Mode' : 'Document Chat Mode'}
            {documentContextForChat ? <span className="ml-2 text-xs text-muted-foreground truncate max-w-[150px]">({documentContextForChat})</span> : ''}
          </Button>
          {chatMode === 'general' && !selectedDocSecuredName && uploadedDocs.length > 0 && (
            <p className="text-xs text-muted-foreground">Select a document in "Document Hub" to enable document-specific chat.</p>
          )}
      </div>
      <Separator className="mb-6" />

      <div className="flex flex-col lg:flex-row gap-8 flex-grow overflow-hidden">
        <div className="w-full lg:w-[35%] xl:w-[30%] space-y-8 flex flex-col">
          <DocumentUploadSection 
            onDocumentUpload={handleDocumentUpload} 
            isUploading={isUploading}
            uploadStatusText={uploadStatusText}
          />
          <DocumentUtilitiesSection
            documents={uploadedDocs}
            selectedDocumentSecuredName={selectedDocSecuredName || undefined} 
            onSelectDocument={handleSelectDocument}
            onUtilityAction={handleUtilityAction}
            isLoading={isLoadingUtility}
            analysisStatusText={analysisStatusText}
            isDocumentSelected={!!selectedDocSecuredName}
            onDeleteDocument={(doc) => setDocToDelete(doc)}
          />
        </div>
        <div className="w-full lg:w-[65%] xl:w-[70%] flex flex-col">
          <ChatTutorSection 
            documentName={chatMode === 'document' ? selectedDocSecuredName : null} // Pass secured name for API, or null
            user={user}
            onClearDocumentContext={() => { // Called when "New Chat" is clicked in ChatTutorSection
              setSelectedDocSecuredName(null);
              setSelectedDocOriginalName(null);
              setChatMode('general'); 
              setAnalysisStatusText(uploadedDocs.length > 0 ? "New chat started. Select a document for utilities or document-specific chat." : "New chat started. Upload a document to begin.");
            }}
          />
        </div>
      </div>
      <HelpTooltip />

      {utilityResult && (
        <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <AlertDialogContent className="max-w-2xl glass-panel">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-primary flex items-center">
                {utilityResult.isProcessingError && <ServerCrash className="inline-block mr-2 h-5 w-5 text-destructive" />}
                {utilityResult.title}
              </AlertDialogTitle>
              {utilityResult.action !== 'mindmap' && (
                <AlertDialogDescription 
                  className="max-h-[60vh] overflow-y-auto text-sm text-foreground/80 whitespace-pre-wrap"
                >
                   {utilityResult.isProcessingError || utilityResult.error
                      ? <p className="text-destructive">{utilityResult.content}</p> 
                      : <div dangerouslySetInnerHTML={{ __html: utilityResult.content.replace(/\n/g, '<br />') }} />
                    }
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>

            {utilityResult.action === 'mindmap' && (
              <div className="mt-2 max-h-[60vh] overflow-y-auto">
                {isMindmapRendering && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Rendering Mind Map...</span>
                  </div>
                )}
                <div ref={mindMapContainerRef} className={isMindmapRendering ? 'hidden' : ''}>
                  {/* Mermaid will render here or show error */}
                  {(utilityResult.error || utilityResult.isProcessingError) && <p className="text-destructive">{utilityResult.content}</p>}
                </div>
                {utilityResult.raw?.content && !utilityResult.error && !utilityResult.isProcessingError && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Show Mermaid Code</summary>
                    <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap max-h-40 overflow-auto">{utilityResult.raw.content}</pre>
                  </details>
                )}
              </div>
            )}
            
            {utilityResult.raw?.thinking && !utilityResult.isProcessingError && !utilityResult.error && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-muted-foreground">Show Reasoning</summary>
                <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{utilityResult.raw.thinking}</pre>
              </details>
            )}
            {utilityResult.raw?.latex_source && utilityResult.action === 'mindmap' && !utilityResult.error && !utilityResult.isProcessingError && (
                <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Show Processed Source (Mindmap)</summary>
                    <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{utilityResult.raw.latex_source}</pre>
                </details>
            )}
            {utilityResult.raw?.audio_url && utilityResult.action === 'podcast' && !utilityResult.error && !utilityResult.isProcessingError && (
                <div className="mt-4">
                    <h4 className="text-sm font-medium text-foreground">Podcast Audio</h4>
                    <audio controls src={utilityResult.raw.audio_url} className="w-full mt-1">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setIsModalOpen(false)} className="btn-glow-primary-hover">Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {docToDelete && (
        <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
          <AlertDialogContent className="glass-panel">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the document "{docToDelete.name}"? This action cannot be undone, and any cached utilities for this document will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDocToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteDocument} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default AppContent;
