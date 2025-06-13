
'use client';

import { useState, type FC, useEffect, useCallback } from 'react';
import DocumentUploadSection from '@/components/document-upload-section';
import DocumentUtilitiesSection from '@/components/document-utilities-section';
import ChatTutorSection from '@/components/chat-tutor-section';
import HelpTooltip from '@/components/help-tooltip';
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
import { MessageCircle, BookOpen, ServerCrash } from 'lucide-react';

export interface DocumentFile {
  name: string; 
  securedName: string; 
}

export type UtilityAction = 'faq' | 'topics' | 'mindmap' | 'podcast';
export type ChatMode = 'general' | 'document';

interface AppContentProps {
  user: User;
}

const AppContent: FC<AppContentProps> = ({ user }) => {
  const [uploadedDocs, setUploadedDocs] = useState<DocumentFile[]>([]);
  const [selectedDocSecuredName, setSelectedDocSecuredName] = useState<string | null>(null);
  const [selectedDocOriginalName, setSelectedDocOriginalName] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>("Select a document to upload.");
  
  const [utilityResult, setUtilityResult] = useState<{ title: string; content: string; raw?: any; action?: UtilityAction; error?: string; isProcessingError?: boolean } | null>(null);
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
          const docs: DocumentFile[] = (result.uploaded_files || []).map(f => ({ name: f.name, securedName: f.securedName }));
          setUploadedDocs(docs);

          if (docs.length === 0) {
            setAnalysisStatusText("No documents uploaded. Upload a file to begin.");
            setSelectedDocSecuredName(null);
            setSelectedDocOriginalName(null);
            if (chatMode === 'document') setChatMode('general');
          } else {
            setAnalysisStatusText("Select a document and utility type.");
            if (selectedDocSecuredName && !docs.find(d => d.securedName === selectedDocSecuredName)) {
                setSelectedDocSecuredName(null); 
                setSelectedDocOriginalName(null);
                if (chatMode === 'document') setChatMode('general');
            } else if (selectedDocSecuredName) {
              // Keep current selection if still valid
              const currentSelectedDoc = docs.find(d => d.securedName === selectedDocSecuredName);
              if (currentSelectedDoc) {
                setSelectedDocOriginalName(currentSelectedDoc.name); // Ensure original name is also up-to-date
                setAnalysisStatusText(`Selected: ${currentSelectedDoc.name}. Ready for utilities or document chat.`);
              }
            }
          }
        }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error fetching documents", description: e.message });
        setAnalysisStatusText(`Error: ${e.message}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.token, chatMode]); // Added chatMode to dependencies if it influences selection logic

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
  
  const handleSelectDocument = (securedName: string) => {
    const selected = uploadedDocs.find(d => d.securedName === securedName);
    if (selected) {
      setSelectedDocSecuredName(selected.securedName);
      setSelectedDocOriginalName(selected.name);
      setChatMode('document'); 
      setAnalysisStatusText(`Selected: ${selected.name}. Choose a utility or chat.`);
      toast({ title: "Document Selected", description: `${selected.name} is now active for utilities and document-specific chat.` });
    } else {
      setSelectedDocSecuredName(null);
      setSelectedDocOriginalName(null);
      setChatMode('general');
      setAnalysisStatusText("Document not found or deselected. Switched to general chat.");
      toast({variant: "warning", title: "Document Deselected", description: "Switched to general chat mode."})
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
    toast({ title: `Deleting ${docNameForToast}...` });
    try {
        const result = await deleteDocumentAction(user.token, docToDelete.securedName);
        if (result.success) {
          toast({ title: "Document Deleted", description: `${docNameForToast} has been deleted.` });
          
          const updatedDocs = uploadedDocs.filter(d => d.securedName !== docToDelete.securedName);
          setUploadedDocs(updatedDocs);

          if (selectedDocSecuredName === docToDelete.securedName) {
            setSelectedDocSecuredName(null);
            setSelectedDocOriginalName(null);
            setChatMode('general');
            setAnalysisStatusText(updatedDocs.length > 0 ? "Document deleted. Select another or upload." : "Document deleted. Upload a new document.");
          } else if (updatedDocs.length === 0) {
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

    setIsLoadingUtility(prev => ({ ...prev, [action]: true }));
    setAnalysisStatusText(`Requesting ${action} for ${selectedDocOriginalName}...`);
    toast({ title: "Processing Utility", description: `Generating ${action} for ${selectedDocOriginalName}...` });

    try {
      let resultData: any;
      const inputArgs = { documentName: selectedDocSecuredName, userToken: user.token }; 

      switch (action) {
        case 'faq':
          resultData = await generateFaq(inputArgs); 
          break;
        case 'topics':
          resultData = await generateTopics(inputArgs);
          break;
        case 'mindmap':
          resultData = await generateMindMap(inputArgs);
          break;
        case 'podcast':
          resultData = await generatePodcastScript(inputArgs);
          break;
        default:
          throw new Error("Unknown utility action");
      }

      let displayContent = "";
      let isProcessingError = false;
      if (resultData.error) {
        // Check if the error indicates a document processing issue from the backend
        if (resultData.error.includes("Failed to retrieve or process text content")) {
          displayContent = `Could not perform '${action}' on "${selectedDocOriginalName}". The server failed to process the document's content. Please try with a different document or check the file.`;
          isProcessingError = true;
        } else {
          displayContent = `An error occurred while generating ${action}: ${resultData.error}`;
        }
      } else {
          if (action === 'topics' && Array.isArray(resultData.topics)) {
            displayContent = resultData.topics.length > 0 ? "- " + resultData.topics.join('\n- ') : "No topics extracted.";
          } else if (action === 'podcast') {
            displayContent = resultData.script || resultData.podcastScript || "No script returned.";
          } else {
            displayContent = resultData.content || resultData.faqList || resultData.mindMap || "No content returned.";
          }
      }

      setUtilityResult({ 
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} for ${selectedDocOriginalName}`, 
        content: displayContent, 
        raw: resultData, 
        action,
        error: resultData.error, // Store original error if any
        isProcessingError 
      });
      setIsModalOpen(true);
      if (resultData.error) {
        setAnalysisStatusText(`Error generating ${action}.`);
        toast({ variant: "destructive", title: `Error Generating ${action}`, description: isProcessingError ? "Document processing failed on server." : resultData.error });
      } else {
        setAnalysisStatusText(`${action} for ${selectedDocOriginalName} received.`);
        toast({ title: "Utility Generated", description: `${action} for ${selectedDocOriginalName} is ready.` });
      }

    } catch (error: any) {
      console.error(`Error generating ${action} via Flask:`, error);
      const errorMsg = error.message || "An unexpected error occurred.";
      setAnalysisStatusText(`Error generating ${action}: ${errorMsg}`);
      toast({ variant: "destructive", title: `Error Generating ${action}`, description: errorMsg });
      setUtilityResult({ 
        title: `Error - ${action} for ${selectedDocOriginalName}`, 
        content: `Failed to generate ${action}. Error: ${errorMsg}`, 
        error: errorMsg, 
        raw: { error: errorMsg }, 
        action 
      });
      setIsModalOpen(true);
    } finally {
      setIsLoadingUtility(prev => ({ ...prev, [action]: false }));
    }
  };

  const documentNameForChat = chatMode === 'document' ? selectedDocOriginalName : null;

  return (
    <div className="flex flex-col flex-grow h-full overflow-hidden">
      <div className="mb-6 flex justify-center items-center">
        <Button 
            onClick={handleToggleChatMode} 
            variant="outline" 
            className="btn-glow-primary-hover shadow-md"
            disabled={chatMode === 'document' ? false : (!selectedDocSecuredName && uploadedDocs.length > 0)}
            title={
              chatMode === 'general' 
                ? (selectedDocSecuredName ? "Switch to Document Chat" : "Select a document to enable document-specific chat") 
                : "Switch to General Chat"
            }
          >
            {chatMode === 'general' ? <MessageCircle className="mr-2 h-5 w-5" /> : <BookOpen className="mr-2 h-5 w-5 text-primary" />}
            {chatMode === 'general' ? 'General Chat Mode' : 'Document Chat Mode'}
            {chatMode === 'document' && selectedDocOriginalName ? <span className="ml-2 text-xs text-muted-foreground truncate max-w-[150px]">({selectedDocOriginalName})</span> : ''}
          </Button>
          {chatMode === 'general' && !selectedDocSecuredName && uploadedDocs.length > 0 && (
            <p className="ml-3 text-xs text-muted-foreground">Select a document in "Document Hub" to enable document-specific chat.</p>
          )}
      </div>

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
            documentName={documentNameForChat} 
            user={user}
            onClearDocumentContext={() => {
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
              <AlertDialogTitle className="font-headline text-primary">
                {utilityResult.isProcessingError && <ServerCrash className="inline-block mr-2 h-5 w-5 text-destructive" />}
                {utilityResult.title}
              </AlertDialogTitle>
              <AlertDialogDescription 
                className="max-h-[60vh] overflow-y-auto text-sm text-foreground/80 whitespace-pre-wrap"
              >
                <div dangerouslySetInnerHTML={{ __html: utilityResult.content.replace(/\n/g, '<br />') }} />
              </AlertDialogDescription>
            </AlertDialogHeader>
            {utilityResult.action === 'mindmap' && utilityResult.raw?.content && !utilityResult.error && (
                <div className="mt-2">
                    <h4 className="text-sm font-medium text-foreground/90">Mermaid Code (for Mind Map):</h4>
                    <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap max-h-40 overflow-auto">{utilityResult.raw.content}</pre>
                </div>
            )}
            {utilityResult.raw?.thinking && !utilityResult.isProcessingError && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-muted-foreground">Show Reasoning</summary>
                <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{utilityResult.raw.thinking}</pre>
              </details>
            )}
            {utilityResult.raw?.latex_source && utilityResult.action === 'mindmap' && !utilityResult.error && (
                <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Show Processed Source (Mindmap)</summary>
                    <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{utilityResult.raw.latex_source}</pre>
                </details>
            )}
            {utilityResult.raw?.audio_url && utilityResult.action === 'podcast' && !utilityResult.error && (
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
                Are you sure you want to delete the document "{docToDelete.name}"? This action cannot be undone.
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


    