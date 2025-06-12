
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentFile } from '@/components/app-content'; // Adjusted import
import type { UtilityAction } from '@/components/app-content'; // Adjusted import
import { Lightbulb, ListOrdered, Brain, Podcast, FileText, Loader2 } from 'lucide-react';

interface DocumentUtilitiesSectionProps {
  documents: DocumentFile[];
  selectedDocumentName: string | undefined;
  onSelectDocument: (documentName: string) => void;
  onUtilityAction: (action: UtilityAction) => void;
  isLoading: Record<UtilityAction, boolean>;
  analysisStatusText: string;
  isDocumentSelected: boolean;
}

const DocumentUtilitiesSection: FC<DocumentUtilitiesSectionProps> = ({
  documents,
  selectedDocumentName,
  onSelectDocument,
  onUtilityAction,
  isLoading,
  analysisStatusText,
  isDocumentSelected,
}) => {
  return (
    <Card className="glass-panel rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <FileText className="mr-2 h-6 w-6 text-primary" />
          Document Utilities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label htmlFor="analysis-file-select" className="block text-sm font-medium mb-1">Select Document:</label>
          <Select 
            onValueChange={onSelectDocument} 
            value={selectedDocumentName} 
            disabled={documents.length === 0}
          >
            <SelectTrigger id="analysis-file-select" className="w-full">
              <SelectValue placeholder={documents.length === 0 ? "No documents uploaded" : "Select a document"} />
            </SelectTrigger>
            <SelectContent>
              {documents.length > 0 ? (
                documents.map((doc) => (
                  <SelectItem key={doc.name} value={doc.name}>
                    {doc.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-doc" disabled>No documents uploaded</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

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
            {isLoading.podcast ? 'Generating...' : 'Generate Podcast'}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{analysisStatusText}</p>
      </CardContent>
    </Card>
  );
};

export default DocumentUtilitiesSection;
