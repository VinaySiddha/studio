
'use client';
import type { FC } from 'react';
import { useState, useEffect } from 'react';
import AppContent from '@/components/app-content'; // This will be the main layout component
import LoginForm from '@/components/login-form';
import SignupForm from '@/components/signup-form';
import LandingPage from '@/components/landing-page'; // A simple landing page

export interface User {
  token: string;
  username: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  // Add other user fields if necessary
}

const HomePage: FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'landing' | 'login' | 'signup'>('landing');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check for existing token on mount
    const storedToken = localStorage.getItem('aiTutorAuthToken');
    const storedUsername = localStorage.getItem('aiTutorUsername');
    if (storedToken && storedUsername) {
      setUser({ token: storedToken, username: storedUsername });
    }
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('aiTutorAuthToken', userData.token);
    localStorage.setItem('aiTutorUsername', userData.username);
    // Store other details if needed
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('aiTutorAuthToken');
    localStorage.removeItem('aiTutorUsername');
    localStorage.removeItem('aiTutorThreadId'); // Also clear threadId on logout
    setAuthView('login'); // Go to login page after logout
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ai-engineer-dark-bg">
        <div className="text-xl text-ai-engineer-text-primary">Loading Tutor Interface...</div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'login') {
      return <LoginForm onLoginSuccess={handleLoginSuccess} onSwitchToSignup={() => setAuthView('signup')} />;
    }
    if (authView === 'signup') {
      return <SignupForm onSignupSuccess={handleLoginSuccess} onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LandingPage onShowLogin={() => setAuthView('login')} onShowSignup={() => setAuthView('signup')} />;
  }

  return (
    <main className="flex flex-col h-screen bg-ai-engineer-dark-bg text-ai-engineer-text-primary p-4 overflow-hidden">
      <header className="flex justify-between items-center mb-4 shrink-0">
        <h1 className="text-2xl font-headline text-ai-engineer-accent-blue">Local AI Engineering Tutor</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ai-engineer-text-secondary">Welcome, {user.username}</span>
          <button 
            onClick={handleLogout} 
            className="px-3 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/80 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>
      <AppContent user={user} />
    </main>
  );
};

export default HomePage;
