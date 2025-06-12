
'use client';

import { useState, type FC } from 'react';
import DocumentUploadSection from '@/components/document-upload-section';
import DocumentUtilitiesSection from '@/components/document-utilities-section';
import ChatTutorSection from '@/components/chat-tutor-section';
import HelpTooltip from '@/components/help-tooltip';
import { useToast } from "@/hooks/use-toast";
import { generateFaq, generateTopics, generateMindMap, generatePodcastScript } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { User } from '@/app/page'; // Assuming User type is exported from page.tsx

export interface DocumentFile {
  name: string;
  content: string; // For now, keep content client-side. Future: might be ID if backend stores files.
  type: string;
}

export type UtilityAction = 'faq' | 'topics' | 'mindmap' | 'podcast';

interface AppContentProps {
  user: User; // The logged-in user
}

const AppContent: FC<AppContentProps> = ({ user }) => {
  const [uploadedDocs, setUploadedDocs] = useState<DocumentFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [utilityResult, setUtilityResult] = useState<{ title: string; content: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingUtility, setIsLoadingUtility] = useState<Record<UtilityAction, boolean>>({
    faq: false,
    topics: false,
    mindmap: false,
    podcast: false,
  });

  const { toast } = useToast();

  // TODO: Adapt handleDocumentUpload. The JS code implies uploading the file to a backend.
  // For now, it will behave as before (client-side content reading).
  // This will need to change if we adopt the JS code's backend file management strategy.
  const handleDocumentUpload = async (file: File) => {
    setIsUploading(true);
    toast({ title: "Processing Document", description: `Reading ${file.name}...` });

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newDoc: DocumentFile = { name: file.name, content, type: file.type };
        // Prevent duplicates, or update if same name
        setUploadedDocs((prev) => {
          const existing = prev.find(doc => doc.name === newDoc.name);
          if (existing) {
            return prev.map(doc => doc.name === newDoc.name ? newDoc : doc);
          }
          return [...prev, newDoc];
        });
        setSelectedDoc(newDoc); // Auto-select
        toast({ title: "Document Ready", description: `${file.name} is ready for use.` });
      };
      reader.onerror = () => {
        toast({ variant: "destructive", title: "File Read Failed", description: `Could not read ${file.name}.` });
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("File processing error:", error);
      toast({ variant: "destructive", title: "File Error", description: "An unexpected error occurred." });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSelectDocument = (documentName: string) => {
    const doc = uploadedDocs.find(d => d.name === documentName);
    if (doc) {
      setSelectedDoc(doc);
      toast({ title: "Document Selected", description: `${doc.name} is now active.` });
    }
  };

  const handleUtilityAction = async (action: UtilityAction) => {
    if (!selectedDoc) {
      toast({ variant: "destructive", title: "No Document Selected", description: "Please select a document first." });
      return;
    }

    setIsLoadingUtility(prev => ({ ...prev, [action]: true }));
    toast({ title: "Processing Utility", description: `Generating ${action} for ${selectedDoc.name}...` });

    try {
      let result: { title: string; content: string } | null = null;
      // The JS code implies backend handles file by name. Current actions take content.
      // For now, we stick to current action's requirements.
      const docContentInput = { documentContent: selectedDoc.content };
      const docTextInput = { documentText: selectedDoc.content }; // for generateTopics

      switch (action) {
        case 'faq':
          const faqRes = await generateFaq(docContentInput);
          result = { title: `FAQ for ${selectedDoc.name}`, content: faqRes.faqList };
          break;
        case 'topics':
          const topicsRes = await generateTopics(docTextInput);
          result = { title: `Key Topics for ${selectedDoc.name}`, content: topicsRes.topics.join('\n- ') };
          break;
        case 'mindmap':
          const mindmapRes = await generateMindMap(docContentInput);
          result = { title: `Mind Map for ${selectedDoc.name}`, content: mindmapRes.mindMap };
          break;
        case 'podcast':
          const podcastRes = await generatePodcastScript(docContentInput);
          result = { title: `Podcast Script for ${selectedDoc.name}`, content: podcastRes.podcastScript };
          break;
      }
      
      if (result) {
        setUtilityResult(result);
        setIsModalOpen(true);
        toast({ title: "Utility Generated", description: `${action} for ${selectedDoc.name} is ready.` });
      }
    } catch (error: any) {
      console.error(`Error generating ${action}:`, error);
      toast({ variant: "destructive", title: `Error Generating ${action}`, description: error.message || "An unexpected error occurred." });
    } finally {
      setIsLoadingUtility(prev => ({ ...prev, [action]: false }));
    }
  };


  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column */}
        <div className="w-full lg:w-[35%] xl:w-[30%] space-y-8">
          <DocumentUploadSection 
            onDocumentUpload={handleDocumentUpload} 
            isUploading={isUploading} 
            // TODO: The JS implies a /documents endpoint and backend status checks.
            // This needs to be integrated if we fully follow that logic.
          />
          <DocumentUtilitiesSection
            documents={uploadedDocs}
            selectedDocumentName={selectedDoc?.name}
            onSelectDocument={handleSelectDocument}
            onUtilityAction={handleUtilityAction}
            isLoading={isLoadingUtility}
            // TODO: Disable based on backend status from JS logic
          />
        </div>
        {/* Right Column */}
        <div className="w-full lg:w-[65%] xl:w-[70%]">
          <ChatTutorSection 
            documentContent={selectedDoc?.content || null} 
            // TODO: Chat needs to be adapted for thread_id from JS logic.
            // It currently relies on passing documentContent directly.
            // Backend status (DB, AI) from JS logic should also control chat availability.
            // Current username for display might also be relevant.
            username={user.username}
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
