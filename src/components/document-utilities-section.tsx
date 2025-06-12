
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentFile } from '@/components/app-content'; 
import type { UtilityAction } from '@/components/app-content'; 
import { Lightbulb, ListOrdered, Brain, Podcast, FileText, Loader2, Trash2 } from 'lucide-react';

interface DocumentUtilitiesSectionProps {
  documents: DocumentFile[];
  selectedDocumentSecuredName: string | undefined;
  onSelectDocument: (securedName: string) => void;
  onUtilityAction: (action: UtilityAction) => void;
  isLoading: Record<UtilityAction, boolean>;
  analysisStatusText: string;
  isDocumentSelected: boolean;
  onDeleteDocument: (doc: DocumentFile) => void;
  // Chat mode toggle is removed from here
}

const DocumentUtilitiesSection: FC<DocumentUtilitiesSectionProps> = ({
  documents,
  selectedDocumentSecuredName,
  onSelectDocument,
  onUtilityAction,
  isLoading,
  analysisStatusText,
  isDocumentSelected,
  onDeleteDocument,
}) => {

  const selectedDocument = documents.find(d => d.securedName === selectedDocumentSecuredName);

  return (
    <Card className="glass-panel rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <FileText className="mr-2 h-6 w-6 text-primary" />
          Document Hub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label htmlFor="doc-util-select" className="block text-sm font-medium mb-1">Select Document:</label>
          <div className="flex gap-2">
            <Select 
              onValueChange={onSelectDocument} 
              value={selectedDocumentSecuredName} 
              disabled={documents.length === 0}
            >
              <SelectTrigger id="doc-util-select" className="w-full">
                <SelectValue placeholder={documents.length === 0 ? "No documents uploaded" : "Select a document"} />
              </SelectTrigger>
              <SelectContent>
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <SelectItem key={doc.securedName} value={doc.securedName}>
                      {doc.name} 
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-doc" disabled>No documents uploaded</SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedDocument && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onDeleteDocument(selectedDocument)}
                title={`Delete ${selectedDocument.name}`}
                className="shrink-0 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive-foreground btn-glow-primary-hover"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
        
        {/* Chat Mode toggle has been moved to AppContent.tsx */}

        <div>
            <label className="block text-sm font-medium mb-1">Document Utilities:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
                onClick={() => onUtilityAction('faq')}
                disabled={!isDocumentSelected || isLoading.faq}
                className="w-full btn-glow-primary-hover"
                variant="outline"
            >
                {isLoading.faq ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                {isLoading.faq ? 'Generating...' : 'Gen FAQ'}
            </Button>
            <Button
                onClick={() => onUtilityAction('topics')}
                disabled={!isDocumentSelected || isLoading.topics}
                className="w-full btn-glow-primary-hover"
                variant="outline"
            >
                {isLoading.topics ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListOrdered className="mr-2 h-4 w-4" />}
                {isLoading.topics ? 'Generating...' : 'Topics'}
            </Button>
            <Button
                onClick={() => onUtilityAction('mindmap')}
                disabled={!isDocumentSelected || isLoading.mindmap}
                className="w-full btn-glow-primary-hover"
                variant="outline"
            >
                {isLoading.mindmap ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                {isLoading.mindmap ? 'Generating...' : 'Mind Map'}
            </Button>
            <Button
                onClick={() => onUtilityAction('podcast')}
                disabled={!isDocumentSelected || isLoading.podcast}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 btn-glow-accent-hover"
            >
                {isLoading.podcast ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Podcast className="mr-2 h-4 w-4" />}
                {isLoading.podcast ? 'Generating...' : 'Podcast'}
            </Button>
            </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground text-center">{analysisStatusText}</p>
      </CardContent>
    </Card>
  );
};

export default DocumentUtilitiesSection;
