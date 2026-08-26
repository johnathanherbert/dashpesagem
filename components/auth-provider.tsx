"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface UserData {
  uid: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  isApproved?: boolean;
  role?: 'admin' | 'supervisor' | 'leader' | 'user';
}

export const ADMIN_EMAIL = 'johnathan.herbert47@gmail.com';

interface FirebaseContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  signUp: (email: string, password: string, name: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  resetPassword: (email: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  confirmReset: (oobCode: string, newPassword: string) => Promise<{
    error: any;
    success: boolean;
  }>;
  refreshUserData: () => Promise<void>;
  signOut: () => Promise<{ error: any }>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            setUserData(data);
            
            await setDoc(userDocRef, {
              lastActive: serverTimestamp(),
              isOnline: true
            }, { merge: true });
          } else {
            const isApproved = currentUser.email === ADMIN_EMAIL;
            
            const newUserData: UserData = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              isApproved,
            };
            
            await setDoc(userDocRef, {
              ...newUserData,
              lastActive: serverTimestamp(),
              isOnline: true
            });
            setUserData(newUserData);
          }
        } catch (error) {
          console.error('❌ Erro ao carregar/criar dados do usuário:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null, success: true };
    } catch (error) {
      return { error, success: false };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const createdUser = userCredential.user;
      
      await updateProfile(createdUser, {
        displayName: name
      });
      
      const isApproved = email === ADMIN_EMAIL;

      const newUserData: UserData = {
        uid: createdUser.uid,
        email: createdUser.email || email,
        name: name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isApproved,
      };
      
      await setDoc(doc(db, 'users', createdUser.uid), newUserData);
      
      return { error: null, success: true };
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      return { error, success: false };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null, success: true };
    } catch (error) {
      console.error('❌ Erro de reset de senha:', error);
      return { error, success: false };
    }
  };

  const confirmReset = async (oobCode: string, newPassword: string) => {
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      return { error: null, success: true };
    } catch (error) {
      console.error('❌ Erro na confirmação do reset de senha:', error);
      return { error, success: false };
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setUserData(userDoc.data() as UserData);
      }
    } catch (err) {
      console.error('❌ Erro ao atualizar dados do usuário:', err);
    }
  };

  const value = {
    user,
    userData,
    loading,
    signIn,
    signUp,
    resetPassword,
    confirmReset,
    refreshUserData,
    signOut,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}
