import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, CheckCircle, Shield, RefreshCw } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

interface GoogleAuthButtonProps {
  isLoggedIn: boolean;
  username: string;
  onLogin: (name: string) => void;
  onLogout: () => void;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  isLoggedIn,
  username,
  onLogin,
  onLogout,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleTriggerLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      onLogin(user.displayName || user.email || 'Guardián Destello');
    } catch (err) {
      console.error('Error signing in with Google:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <div className="relative">
      {!isLoggedIn ? (
        <button
          onClick={handleTriggerLogin}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-neutral-100 rounded-full text-xs font-bold font-headline-lg transition-all shadow-md active:scale-95 disabled:opacity-60"
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11C18.281 1.945 15.539.8 12.24.8 6.008.8.96 5.823.96 12s5.048 11.2 11.28 11.2c6.51 0 10.823-4.57 10.823-11.023 0-.74-.08-1.305-.176-1.892H12.24z"
              />
            </svg>
          )}
          <span>{isLoading ? 'Conectando...' : 'Conectar Cuenta Google'}</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/30 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Progreso Guardado en la Nube ({username})</span>
          </span>
          <button
            onClick={handleTriggerLogout}
            title="Cerrar Sesión"
            className="p-2 bg-white/5 hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-full transition-all active:scale-95 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
