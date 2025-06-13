
'use client';
import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, MessageCircle } from 'lucide-react';

interface LandingPageProps {
  onShowLogin: () => void;
  onShowSignup: () => void;
}

const LandingPage: FC<LandingPageProps> = ({ onShowLogin, onShowSignup }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ai-engineer-dark-bg text-ai-engineer-text-primary p-6 text-center">
      <div className="mb-8">
        <FileText size={64} className="text-ai-engineer-accent-blue mx-auto" />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold font-headline mb-6">
        Welcome to the Local AI Engineering Tutor
      </h1>
      <p className="text-lg text-ai-engineer-text-secondary mb-10 max-w-2xl">
        Upload your engineering documents, ask questions, generate summaries, FAQs, mind maps, and even podcasts.
        Your personal AI assistant for focused learning and research.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button
          onClick={onShowLogin}
          size="lg"
          className="w-full sm:w-auto bg-ai-engineer-accent-blue hover:bg-ai-engineer-accent-blue/90 text-primary-foreground btn-glow-primary-hover text-base px-8 py-6"
        >
          Login to Your Account
        </Button>
        <Button
          onClick={onShowSignup}
          variant="outline"
          size="lg"
          className="w-full sm:w-auto border-ai-engineer-accent-teal text-ai-engineer-accent-teal hover:bg-ai-engineer-accent-teal/10 hover:text-ai-engineer-accent-teal btn-glow-accent-hover text-base px-8 py-6"
        >
          Create New Account
        </Button>
      </div>
      <footer className="mt-16 text-xs text-ai-engineer-text-muted">
        <p>&copy; {new Date().getFullYear()} AI Engineering Tutor. All rights reserved.</p>
        <p>Ensure your local AI (Ollama) and database (MongoDB) are running for full functionality.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
