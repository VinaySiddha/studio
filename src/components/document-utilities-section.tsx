
'use client';
import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, ListChecks, Sigma, Brain, Podcast, FileText, Trash2, Loader2 } from 'lucide-react';
import type { DocumentFile, UtilityAction } from './app-content'; // Assuming types are here

interface DocumentUtilitiesSectionProps {
  documents: DocumentFile[];
  selectedDocumentSecuredName?: string;
  onSelectDocument: (securedName: string | null) => void;
  onUtilityAction: (action: UtilityAction) => void;
  isLoading: Record<UtilityAction, boolean>;
  analysisStatusText: string;
  isDocumentSelected: boolean;
  onDeleteDocument: (doc: DocumentFile) => void;
}

const utilityButtons: { action: UtilityAction; label: string; icon: FC<any>, colorClass: string }[] = [
  { action: 'faq', label: 'Gen FAQ', icon: Lightbulb, colorClass: 'bg-ai-engineer-accent-purple hover:bg-ai-engineer-accent-purple/90' },
  { action: 'topics', label: 'Topics', icon: ListChecks, colorClass: 'bg-ai-engineer-accent-purple hover:bg-ai-engineer-accent-purple/90' },
  { action: 'mindmap', label: 'Mind Map', icon: Brain, colorClass: 'bg-ai-engineer-accent-purple hover:bg-ai-engineer-accent-purple/90' },
  { action: 'podcast', label: 'Podcast', icon: Podcast, colorClass: 'bg-ai-engineer-accent-teal hover:bg-ai-engineer-accent-teal/90' },
];

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
  const selectedDoc = documents.find(d => d.securedName === selectedDocumentSecuredName);

  return (
    <Card className="flex-grow flex flex-col glass-panel !bg-ai-engineer-card-bg border-ai-engineer-border shadow-lg min-h-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-headline text-ai-engineer-accent-teal flex items-center">
          <Sigma className="mr-2 h-5 w-5" /> Document Hub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col min-h-0">
        <div className="space-y-1.5">
          <Label htmlFor="document-select" className="text-sm text-ai-engineer-text-secondary">Select Document:</Label>
          <div className="flex items-center gap-2">
            <Select
              value={selectedDocumentSecuredName || ""}
              onValueChange={(value) => onSelectDocument(value === "no-doc-placeholder" ? null : value)}
              disabled={documents.length === 0}
            >
              <SelectTrigger id="document-select" className="flex-grow bg-ai-engineer-input-bg text-ai-engineer-text-primary placeholder:text-ai-engineer-text-muted">
                <SelectValue placeholder="Select a document..." />
              </SelectTrigger>
              <SelectContent className="!bg-ai-engineer-card-bg border-ai-engineer-border text-ai-engineer-text-primary">
                {documents.length === 0 ? (
                  <SelectItem value="no-doc-placeholder" disabled>No documents uploaded</SelectItem>
                ) : (
                  <>
                    <SelectItem value="no-doc-placeholder">-- Deselect Document --</SelectItem>
                    <SelectGroup>
                      <SelectLabel className="text-ai-engineer-text-muted">Your Documents</SelectLabel>
                      {documents.map((doc) => (
                        <SelectItem key={doc.securedName} value={doc.securedName} className="hover:!bg-ai-engineer-accent-purple/20">
                          <div className="flex items-center">
                            <FileText size={16} className="mr-2 text-ai-engineer-text-secondary" />
                            <span className="truncate max-w-[200px] sm:max-w-[250px]">{doc.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
            {selectedDoc && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onDeleteDocument(selectedDoc)} 
                title={`Delete ${selectedDoc.name}`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm text-ai-engineer-text-secondary">Document Utilities:</Label>
          <div className="grid grid-cols-2 gap-2">
            {utilityButtons.map(({ action, label, icon: Icon, colorClass }) => (
              <Button
                key={action}
                onClick={() => onUtilityAction(action)}
                disabled={!isDocumentSelected || isLoading[action]}
                className={`w-full text-primary-foreground ${colorClass} btn-glow-accent-hover text-xs sm:text-sm`}
              >
                {isLoading[action] ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ai-engineer-text-muted text-center min-h-[1.2em] mt-auto pt-2">
          {analysisStatusText}
        </p>
      </CardContent>
    </Card>
  );
};

export default DocumentUtilitiesSection;
