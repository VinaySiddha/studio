
'use client';
import type { FC, ChangeEvent } from 'react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Using ShadCN Input
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud, Loader2, FileText } from 'lucide-react';

interface DocumentUploadSectionProps {
  onDocumentUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadStatusText: string;
}

const DocumentUploadSection: FC<DocumentUploadSectionProps> = ({ 
  onDocumentUpload, 
  isUploading, 
  uploadStatusText 
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onDocumentUpload(selectedFile);
    }
  };

  return (
    <Card className="glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-headline text-ai-engineer-accent-blue flex items-center">
          <UploadCloud className="mr-2 h-5 w-5" /> Document Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
            {/* Using ShadCN Input for file selection - styled with a label for better UX */}
            <label 
                htmlFor="file-upload-input" 
                className="flex items-center justify-center w-full px-3 py-2 text-sm border-2 border-dashed rounded-md cursor-pointer border-ai-engineer-border hover:border-ai-engineer-accent-blue text-ai-engineer-text-secondary hover:text-ai-engineer-accent-blue transition-colors"
            >
                {selectedFile ? (
                    <>
                        <FileText className="mr-2 h-4 w-4" /> 
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                    </>
                ) : (
                    "Choose File (PDF, DOCX, PPTX, TXT, Code)"
                )}
            </label>
            <Input 
                id="file-upload-input"
                ref={fileInputRef}
                type="file" 
                onChange={handleFileChange} 
                className="hidden" // Hidden as we use a custom styled label
                accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.txt,text/plain,.json,.py,.js,.html,.css,.java,.c,.cpp,.h,.hpp,.cs,.go,.rb,.php,.swift,.kt,.rs,.md"
            />
        </div>
        
        <Button 
          onClick={handleUploadClick} 
          disabled={!selectedFile || isUploading}
          className="w-full bg-ai-engineer-accent-blue hover:bg-ai-engineer-accent-blue/90 text-primary-foreground btn-glow-primary-hover"
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          {isUploading ? 'Uploading...' : 'Upload & Add to Knowledge Base'}
        </Button>
        <p className="text-xs text-ai-engineer-text-muted text-center min-h-[1.2em]">
          {uploadStatusText}
        </p>
      </CardContent>
    </Card>
  );
};

export default DocumentUploadSection;
