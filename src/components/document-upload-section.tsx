
import type { ChangeEvent, FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, Loader2 } from 'lucide-react';

interface DocumentUploadSectionProps {
  onDocumentUpload: (file: File) => void;
  isUploading: boolean;
  uploadStatusText: string;
}

const DocumentUploadSection: FC<DocumentUploadSectionProps> = ({ 
  onDocumentUpload, 
  isUploading,
  uploadStatusText 
}) => {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onDocumentUpload(file);
    }
  };

  return (
    <Card className="glass-panel rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <UploadCloud className="mr-2 h-6 w-6 text-primary" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="text-sm font-medium">Select Document:</Label>
          <Input 
            id="file-upload" 
            type="file" 
            onChange={handleFileChange} 
            accept=".txt,.pdf,.md,.docx,.pptx,.json,.py,.js,.html,.css,.java,.c,.cpp,.h,.hpp,.cs,.go,.rb,.php,.swift,.kt,.rs,.jpg,.jpeg,.png" 
            className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            disabled={isUploading}
          />
        </div>
        <Button 
          onClick={() => {
            // This button is more illustrative in this setup as upload triggers on file change.
            // In a different flow, it could trigger processing of an already selected file.
            // If a file needs to be selected first and THEN this button clicked:
            // document.getElementById('file-upload')?.click(); 
            // Or manage file selection state separately and pass to onDocumentUpload here.
            // For now, we assume onDocumentUpload is called by the Input's onChange.
          }} 
          className="w-full btn-glow-primary-hover"
          disabled={isUploading || !document.getElementById('file-upload') || !(document.getElementById('file-upload') as HTMLInputElement).files?.length}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Upload & Add to Knowledge Base'
          )}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{uploadStatusText}</p>
      </CardContent>
    </Card>
  );
};

export default DocumentUploadSection;
