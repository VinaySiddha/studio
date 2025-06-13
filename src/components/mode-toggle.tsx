// src/components/mode-toggle.tsx
'use client';

import type { FC } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageSquare, BookText } from 'lucide-react'; // Icons for modes

export type ChatbotMode = 'chat' | 'document';

interface ModeToggleProps {
  currentMode: ChatbotMode;
  onModeChange: (mode: ChatbotMode) => void;
}

const ModeToggle: FC<ModeToggleProps> = ({ currentMode, onModeChange }) => {
  const isChatMode = currentMode === 'chat';

  const toggleMode = () => {
    onModeChange(isChatMode ? 'document' : 'chat');
  };

  return (
    <div className="flex items-center space-x-3 p-2 rounded-lg bg-card/50 border border-border">
      <div className={`flex items-center space-x-1.5 transition-colors ${isChatMode ? 'text-mode-chat-accent font-semibold' : 'text-muted-foreground'}`}>
        <MessageSquare size={18} />
        <Label htmlFor="mode-switch" className="text-sm cursor-pointer">Chat Mode</Label>
      </div>
      <Switch
        id="mode-switch"
        checked={!isChatMode} // true when document mode is active
        onCheckedChange={toggleMode}
        className="data-[state=checked]:bg-mode-document-accent data-[state=unchecked]:bg-mode-chat-accent"
      />
      <div className={`flex items-center space-x-1.5 transition-colors ${!isChatMode ? 'text-mode-document-accent font-semibold' : 'text-muted-foreground'}`}>
         <BookText size={18} />
        <Label htmlFor="mode-switch" className="text-sm cursor-pointer">Document Mode</Label>
      </div>
    </div>
  );
};

export default ModeToggle;
