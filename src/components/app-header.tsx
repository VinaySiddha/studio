
import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import type { User } from '@/app/page'; // Assuming User type is exported from page.tsx

interface AppHeaderProps {
  user: User | null;
  onLogout: () => void;
}

const AppHeader: FC<AppHeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="py-6 md:py-8 border-b border-border/50">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <h1 className="font-headline text-2xl md:text-3xl font-bold">
          <span
            className="bg-gradient-to-r from-primary via-blue-400 to-teal-400 bg-clip-text text-transparent"
            style={{ textShadow: '0 0 8px hsl(var(--primary)/0.5), 0 0 16px hsl(var(--primary)/0.3)' }}
          >
            Local AI Engineering Tutor
          </span>
        </h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {user.username}</span>
            <Button variant="outline" size="sm" onClick={onLogout} className="btn-glow-primary-hover">
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
