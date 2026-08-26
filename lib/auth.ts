import { auth } from './firebase';
import { signOut as firebaseSignOut } from 'firebase/auth';

export async function signOut() {
  try {
    if (auth && typeof auth.signOut === 'function') {
      await firebaseSignOut(auth);
    }
  } catch (error) {
    console.error('Error signing out:', error);
  } finally {
    window.location.href = '/login';
  }
}

export async function getCurrentUser() {
  return auth?.currentUser || null;
}
