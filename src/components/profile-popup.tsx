// src/components/profile-popup.tsx
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, KeyRound, AlertTriangle, Info } from 'lucide-react';

const ApiKeySchema = z.object({
  apiKey: z.string().min(1, 'API Key cannot be empty.'),
});
type ApiKeyFormData = z.infer<typeof ApiKeySchema>;

interface ProfilePopupProps {
  onApiKeyUpdate: (key: string | null) => void;
  initialApiKey: string | null;
}

const ProfilePopup: FC<ProfilePopupProps> = ({ onApiKeyUpdate, initialApiKey }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyFormData>({
    resolver: zodResolver(ApiKeySchema),
    defaultValues: { apiKey: initialApiKey || '' },
  });

  useEffect(() => {
    setValue('apiKey', initialApiKey || '');
  }, [initialApiKey, setValue]);

  const onSubmit: SubmitHandler<ApiKeyFormData> = async (data) => {
    localStorage.setItem('geminiUserApiKey', data.apiKey);
    onApiKeyUpdate(data.apiKey);
    toast({
      title: 'API Key Updated (Locally)',
      description: 'Your Gemini API Key has been stored in your browser for this session. Ensure the server has GOOGLE_API_KEY set.',
    });
    setIsOpen(false);
  };

  const handleClearKey = () => {
    localStorage.removeItem('geminiUserApiKey');
    onApiKeyUpdate(null);
    reset({ apiKey: '' });
    toast({
      title: 'API Key Cleared (Locally)',
      description: 'Your Gemini API Key has been removed from browser storage.',
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full btn-glow-primary-hover">
          <UserCircle className="h-6 w-6 text-primary" />
          <span className="sr-only">Open Profile Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-panel">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <KeyRound className="mr-2 h-5 w-5 text-primary" />
            Gemini API Key
          </DialogTitle>
          <DialogDescription>
            Enter your Google Gemini API key here. This key will be stored in your browser's local storage for this session.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-3 my-4 rounded-md bg-blue-900/30 border border-blue-700 text-blue-300 text-xs flex items-start gap-2">
          <Info size={28} className="shrink-0 mt-0.5 text-blue-400"/>
          <div>
            <strong>For Full Functionality:</strong> The Genkit AI framework, running on the server, uses a <code className="bg-muted/50 text-foreground px-1 py-0.5 rounded mx-0.5">GOOGLE_API_KEY</code> environment variable.
            Please ensure this is set correctly in your server deployment environment for the AI to work. Storing the key here is for your local reference.
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="apiKey" className="text-sm font-medium">
              Your Gemini API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key"
              {...register('apiKey')}
              className="mt-1"
            />
            {errors.apiKey && <p className="mt-1 text-xs text-destructive">{errors.apiKey.message}</p>}
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            {initialApiKey ? (
               <Button type="button" variant="destructive" onClick={handleClearKey} disabled={isSubmitting} className="btn-glow-primary-hover">
                Clear Stored Key
              </Button>
            ) : <div />} {/* Placeholder for spacing when no key to clear */}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="btn-glow-primary-hover">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting} className="btn-glow-primary-hover">
                {isSubmitting ? 'Saving...' : 'Save Key'}
              </Button>
            </div>
          </DialogFooter>
        </form>
         <div className="mt-4 p-3 rounded-md bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-xs flex items-start gap-2">
            <AlertTriangle size={28} className="shrink-0 mt-0.5 text-yellow-400"/>
            <div>
              <strong>Security Note:</strong> API keys are sensitive. Never hardcode them directly into client-side code for production applications. 
              This prototype stores the key in your browser's local storage, which is not secure for production use.
              Always use server-side environment variables for API keys in live environments.
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePopup;
