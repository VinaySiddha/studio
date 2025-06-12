
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
  handleDocumentUploadAction 
} from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { User } from '@/app/page';

export interface DocumentFile {
  name: string; 
  type?: string; 
}

export type UtilityAction = 'faq' | 'topics' | 'mindmap' | 'podcast';

interface AppContentProps {
  user: User;
}

const AppContent: FC<AppContentProps> = ({ user }) => {
  const [uploadedDocs, setUploadedDocs] = useState<DocumentFile[]>([]);
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null);
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

  const { toast } = useToast();

  useEffect(() => {
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
            const docs = result.uploaded_files.map(name => ({ name }));
            setUploadedDocs(docs);
            if (docs.length === 0) {
              setAnalysisStatusText("No documents found on server. Upload a file.");
            } else {
              setAnalysisStatusText("Select a document and utility type.");
            }
          }
        } catch (e: any) {
          toast({ variant: "destructive", title: "Error fetching documents", description: e.message });
          setAnalysisStatusText(`Error: ${e.message}`);
        }
      }
    };
    fetchDocuments();
  }, [user, toast]);


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
      if (result.error) {
        throw new Error(result.error);
      }
      
      setUploadStatusText(`Successfully uploaded ${result.filename || file.name}.`);
      toast({ title: "Document Uploaded", description: `${result.filename || file.name} processed by server. KB: ${result.vector_count >=0 ? result.vector_count : 'N/A'}` });
      
      const listResult = await listDocumentsAction(user.token);
      if (listResult.uploaded_files) {
        const newDocs = listResult.uploaded_files.map(name => ({ name }));
        setUploadedDocs(newDocs);
        // Automatically select the newly uploaded document if it's the only one or matches
        if (newDocs.length === 1 || newDocs.find(d => d.name === (result.filename || file.name))) {
            setSelectedDocName(result.filename || file.name);
        }
      }
    } catch (error: any) {
      console.error("File upload to Flask error:", error);
      setUploadStatusText(`Error uploading ${file.name}: ${error.message}`);
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSelectDocument = (documentName: string) => {
    setSelectedDocName(documentName);
    if (documentName) {
      setAnalysisStatusText(`Selected: ${documentName}. Choose a utility.`);
      toast({ title: "Document Selected", description: `${documentName} is now active for utilities and chat.` });
    } else {
      setAnalysisStatusText("No document selected.");
      toast({ title: "Document Context Cleared", description: "Chat will now be in general mode." });
    }
  };

  const handleUtilityAction = async (action: UtilityAction) => {
    if (!selectedDocName) {
      setAnalysisStatusText("Please select a document first.");
      toast({ variant: "destructive", title: "No Document Selected", description: "Please select a document first." });
      return;
    }
    if (!user?.token) {
      toast({ variant: "destructive", title: "Authentication Error", description: "Action requires login." });
      return;
    }

    setIsLoadingUtility(prev => ({ ...prev, [action]: true }));
    setAnalysisStatusText(`Requesting ${action} for ${selectedDocName} from server...`);
    toast({ title: "Processing Utility", description: `Generating ${action} for ${selectedDocName}...` });

    try {
      let resultData: any;
      const inputArgs = { documentName: selectedDocName }; 

      switch (action) {
        case 'faq':
          resultData = await generateFaq(inputArgs); 
          setUtilityResult({ title: `FAQ for ${selectedDocName}`, content: resultData.content || resultData.faqList || "No FAQ content returned.", raw: resultData, action });
          break;
        case 'topics':
          resultData = await generateTopics(inputArgs);
          // Assuming Flask returns 'content' as a string of topics, or resultData.topics as array
          const topicsContent = Array.isArray(resultData.topics) ? resultData.topics.join('\n- ') : (resultData.content || "No topics returned.");
          setUtilityResult({ title: `Key Topics for ${selectedDocName}`, content: topicsContent, raw: resultData, action });
          break;
        case 'mindmap':
          resultData = await generateMindMap(inputArgs);
          setUtilityResult({ title: `Mind Map (Mermaid Code) for ${selectedDocName}`, content: resultData.content || resultData.mindMap || "No mind map content returned.", raw: resultData, action });
          break;
        case 'podcast':
          resultData = await generatePodcastScript(inputArgs);
          setUtilityResult({ title: `Podcast Script for ${selectedDocName}`, content: resultData.script || "No script returned.", raw: resultData, action });
          break;
      }
      
      setIsModalOpen(true);
      setAnalysisStatusText(`${action} for ${selectedDocName} received from server.`);
      toast({ title: "Utility Generated", description: `${action} for ${selectedDocName} is ready.` });
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
            selectedDocumentName={selectedDocName || undefined} 
            onSelectDocument={handleSelectDocument}
            onUtilityAction={handleUtilityAction}
            isLoading={isLoadingUtility}
            analysisStatusText={analysisStatusText}
            isDocumentSelected={!!selectedDocName}
          />
        </div>
        <div className="w-full lg:w-[65%] xl:w-[70%]">
          <ChatTutorSection 
            documentName={selectedDocName} 
            username={user.username}
            authToken={user.token} 
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
    </>
  );
};

export default AppContent;
