
'use client';

import { useState, type FC, useEffect } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { User } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Trash2, MessageSquareText, BookOpenText } from 'lucide-react';


export interface DocumentFile {
  name: string; // This should be the original_filename for display
  securedName: string; // This is the filename Flask uses (e.g., with UUID)
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
  
  const [utilityResult, setUtilityResult] = useState<{ title: string; content: string; raw?: any; action?: UtilityAction } | null>(null);
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

  const fetchDocuments = async () => {
    if (user?.token) {
      setAnalysisStatusText("Loading documents from server...");
      try {
        const result = await listDocumentsAction(user.token);
        if (result.error) {
          toast({ variant: "destructive", title: "Failed to load documents", description: result.error });
          setAnalysisStatusText(`Error: ${result.error}`);
          setUploadedDocs([]);
        } else {
          // Assuming Flask returns original_filename for display and we need to map/store it
          // For now, assuming listDocumentsAction returns an array of {name: original_filename, securedName: secured_filename}
          // This part needs alignment with what Flask actually returns for /documents
          // Let's assume Flask returns a list of original_filenames and we use that for display,
          // but for actions, we'll need the securedName. This needs refinement.
          // For now, if Flask's /documents returns original_filename:
          const docs: DocumentFile[] = (result.uploaded_files || []).map((name: any) => {
            // If Flask returns objects with original and secured names:
            if (typeof name === 'object' && name.original_filename && name.filename) {
              return { name: name.original_filename, securedName: name.filename };
            }
            // If Flask returns just original_filenames, we can't easily get securedName here
            // This part of the logic is simplified and needs to be robust based on actual Flask response
            return { name: name as string, securedName: name as string }; // Placeholder if only name is returned
          });
          setUploadedDocs(docs);

          if (docs.length === 0) {
            setAnalysisStatusText("No documents found on server. Upload a file.");
            setSelectedDocSecuredName(null);
            setSelectedDocOriginalName(null);
            setChatMode('general');
          } else {
            setAnalysisStatusText("Select a document and utility type.");
            // If a document was previously selected, try to keep it selected
            if (selectedDocSecuredName && !docs.find(d => d.securedName === selectedDocSecuredName)) {
                setSelectedDocSecuredName(null); // Previously selected doc no longer exists
                setSelectedDocOriginalName(null);
                if (chatMode === 'document') setChatMode('general'); // Switch to general if doc is gone
            }
          }
        }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error fetching documents", description: e.message });
        setAnalysisStatusText(`Error: ${e.message}`);
      }
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user.token]);


  const handleDocumentUpload = async (file: File) => {
    if (!user?.token) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to upload." });
      return;
    }
    setIsUploading(true);
    setUploadStatusText(`Uploading ${file.name} to server...`);
    toast({ title: "Uploading Document", description: `Sending ${file.name} to the server...` });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await handleDocumentUploadAction(formData, user.token);
      if (result.error || !result.filename || !result.original_filename) {
        throw new Error(result.error || "Upload failed to return necessary file information.");
      }
      
      setUploadStatusText(`Successfully uploaded ${result.original_filename}.`);
      toast({ title: "Document Uploaded", description: `${result.original_filename} processed. KB: ${result.vector_count ?? 'N/A'}` });
      
      await fetchDocuments(); // Refresh document list

      // Optionally auto-select the new document
      setSelectedDocSecuredName(result.filename);
      setSelectedDocOriginalName(result.original_filename);
      setChatMode('document'); // Switch to document chat mode
      
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
      toast({ title: "Document Selected", description: `${selected.name} is now active for utilities and chat.` });
    }
  };
  
  const handleConfirmDeleteDocument = async () => {
    if (!docToDelete || !user.token) return;
    toast({ title: `Deleting ${docToDelete.name}...` });
    const result = await deleteDocumentAction(user.token, docToDelete.securedName);
    if (result.success) {
      toast({ title: "Document Deleted", description: `${docToDelete.name} has been deleted.` });
      setUploadedDocs(prev => prev.filter(d => d.securedName !== docToDelete.securedName));
      if (selectedDocSecuredName === docToDelete.securedName) {
        setSelectedDocSecuredName(null);
        setSelectedDocOriginalName(null);
        setChatMode('general');
      }
    } else {
      toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
    }
    setDocToDelete(null);
  };


  const handleUtilityAction = async (action: UtilityAction) => {
    if (!selectedDocSecuredName) {
      setAnalysisStatusText("Please select a document first.");
      toast({ variant: "destructive", title: "No Document Selected", description: "Please select a document first." });
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
          setUtilityResult({ title: `FAQ for ${selectedDocOriginalName}`, content: resultData.content || resultData.faqList || "No FAQ content returned.", raw: resultData, action });
          break;
        case 'topics':
          resultData = await generateTopics(inputArgs);
          const topicsContent = Array.isArray(resultData.topics) ? resultData.topics.join('\n- ') : (resultData.content || "No topics returned.");
          setUtilityResult({ title: `Key Topics for ${selectedDocOriginalName}`, content: topicsContent, raw: resultData, action });
          break;
        case 'mindmap':
          resultData = await generateMindMap(inputArgs);
          setUtilityResult({ title: `Mind Map (Mermaid Code) for ${selectedDocOriginalName}`, content: resultData.content || resultData.mindMap || "No mind map content returned.", raw: resultData, action });
          break;
        case 'podcast':
          resultData = await generatePodcastScript(inputArgs);
          setUtilityResult({ title: `Podcast Script for ${selectedDocOriginalName}`, content: resultData.script || "No script returned.", raw: resultData, action });
          break;
      }
      if (resultData.error) throw new Error(resultData.error);
      setIsModalOpen(true);
      setAnalysisStatusText(`${action} for ${selectedDocOriginalName} received.`);
      toast({ title: "Utility Generated", description: `${action} for ${selectedDocOriginalName} is ready.` });
    } catch (error: any) {
      console.error(`Error generating ${action} via Flask:`, error);
      const errorMsg = error.message || "An unexpected error occurred.";
      setAnalysisStatusText(`Error generating ${action}: ${errorMsg}`);
      toast({ variant: "destructive", title: `Error Generating ${action}`, description: errorMsg });
      setUtilityResult({ title: `Error - ${action}`, content: `Failed to generate ${action}: ${errorMsg}`, raw: { error: errorMsg }, action});
      setIsModalOpen(true);
    } finally {
      setIsLoadingUtility(prev => ({ ...prev, [action]: false }));
    }
  };

  const toggleChatMode = () => {
    if (chatMode === 'general') {
      if (selectedDocSecuredName) {
        setChatMode('document');
        toast({ title: "Chat Mode Switched", description: `Now chatting about ${selectedDocOriginalName}.` });
      } else {
        toast({ variant: "default", title: "Select Document", description: "Please select a document to switch to document chat mode." });
      }
    } else {
      setChatMode('general');
      toast({ title: "Chat Mode Switched", description: "Now in general chat mode." });
    }
  };

  const documentNameForChat = chatMode === 'document' ? selectedDocOriginalName : null;


  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-[35%] xl:w-[30%] space-y-8">
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
            currentChatMode={chatMode}
            onToggleChatMode={toggleChatMode}
            canToggleToDocumentMode={!!selectedDocSecuredName}
          />
        </div>
        <div className="w-full lg:w-[65%] xl:w-[70%]">
          <ChatTutorSection 
            documentName={documentNameForChat} 
            user={user}
            onClearDocumentContext={() => {
              setSelectedDocSecuredName(null);
              setSelectedDocOriginalName(null);
              if (chatMode === 'document') setChatMode('general');
            }}
          />
        </div>
      </div>
      <HelpTooltip />

      {utilityResult && (
        <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <AlertDialogContent className="max-w-2xl glass-panel">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-primary">{utilityResult.title}</AlertDialogTitle>
              <AlertDialogDescription className="max-h-[60vh] overflow-y-auto text-sm text-foreground/80 whitespace-pre-wrap">
                {utilityResult.content}
                {utilityResult.raw?.thinking && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-muted-foreground">Show Reasoning</summary>
                    <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap">{utilityResult.raw.thinking}</pre>
                  </details>
                )}
                {utilityResult.raw?.latex_source && utilityResult.action === 'mindmap' && (
                    <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-muted-foreground">Show Processed Source (Mindmap)</summary>
                        <pre className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap">{utilityResult.raw.latex_source}</pre>
                    </details>
                )}
                {utilityResult.raw?.audio_url && utilityResult.action === 'podcast' && (
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-foreground">Podcast Audio</h4>
                        <audio controls src={utilityResult.raw.audio_url} className="w-full mt-1">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
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
    </>
  );
};

export default AppContent;
