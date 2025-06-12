
'use client';

import { useState, useEffect, type FC } from 'react';
import AppHeader from '@/components/app-header';
import AppContent from '@/components/app-content';
import LandingPage from '@/components/landing-page';
import LoginForm from '@/components/login-form';
import SignupForm from '@/components/signup-form';
import { useToast } from "@/hooks/use-toast";
import { loginUserAction, signupUserAction } from '@/app/actions'; // Assuming these will be created

export interface User {
  username: string;
  token: string;
  // Add other user fields if necessary, e.g., firstname, email from signup
  firstname?: string;
  lastname?: string;
  email?: string;
  gender?: string;
  mobile?: string;
  organization?: string;
}

const Page: FC = () => {
  const [view, setView] = useState<'landing' | 'login' | 'signup' | 'app'>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // To prevent flash of landing page

  const { toast } = useToast();

  useEffect(() => {
    const storedToken = localStorage.getItem('aiTutorAuthToken');
    const storedUsername = localStorage.getItem('aiTutorUsername');
    // Could store more user details if needed
    if (storedToken && storedUsername) {
      setUser({ username: storedUsername, token: storedToken });
      setView('app');
    }
    setIsLoadingAuth(false);
  }, []);

  const handleLogin = async (formData: FormData) => {
    setAuthError(null);
    setIsLoadingAuth(true);
    const result = await loginUserAction(formData);
    if (result.user) {
      setUser(result.user);
      localStorage.setItem('aiTutorAuthToken', result.user.token);
      localStorage.setItem('aiTutorUsername', result.user.username);
      // Potentially store other user details from result.user if returned
      setView('app');
      toast({ title: "Login Successful", description: `Welcome back, ${result.user.username}!` });
    } else if (result.error) {
      setAuthError(result.error);
      toast({ variant: "destructive", title: "Login Failed", description: result.error });
    }
    setIsLoadingAuth(false);
  };

  const handleSignup = async (formData: FormData) => {
    setAuthError(null);
    setIsLoadingAuth(true);
    const result = await signupUserAction(formData);
    if (result.user) {
      setUser(result.user);
      localStorage.setItem('aiTutorAuthToken', result.user.token);
      localStorage.setItem('aiTutorUsername', result.user.username);
      // Potentially store other user details from result.user
      setView('app');
      toast({ title: "Signup Successful", description: `Welcome, ${result.user.username}! You are now logged in.` });
    } else if (result.error) {
      setAuthError(result.error);
      toast({ variant: "destructive", title: "Signup Failed", description: result.error });
    }
    setIsLoadingAuth(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('aiTutorAuthToken');
    localStorage.removeItem('aiTutorUsername');
    localStorage.removeItem('aiTutorThreadId'); // From the provided JS
    setView('landing');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
  };

  if (isLoadingAuth && !user) { // Show loading only if not already logged in from previous session
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground font-body items-center justify-center">
        <div className="animate-pulse text-xl">Loading application...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body">
      <AppHeader user={user} onLogout={handleLogout} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {view === 'landing' && <LandingPage onShowLogin={() => setView('login')} onShowSignup={() => setView('signup')} />}
        {view === 'login' && <LoginForm onSubmit={handleLogin} onShowSignup={() => setView('signup')} error={authError} isLoading={isLoadingAuth} />}
        {view === 'signup' && <SignupForm onSubmit={handleSignup} onShowLogin={() => setView('login')} error={authError} isLoading={isLoadingAuth} />}
        {view === 'app' && user && <AppContent user={user} />}
      </main>
    </div>
  );
};

export default Page;
