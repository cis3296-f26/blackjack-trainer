import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

import { AuthContext, type AuthContextType } from "./auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const creatingAccount = useRef(false);

  async function signup(email: string, password: string, displayName?: string) {
    // Publish the signed-in user after their name is saved, so the table receives
    // the completed profile instead of briefly mounting with only an email.
    creatingAccount.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      if (displayName) await updateProfile(credential.user, { displayName });
      return credential;
    } finally {
      creatingAccount.current = false;
      setCurrentUser(auth.currentUser);
    }
  }

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!creatingAccount.current) setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="auth-page" role="status">
          Opening your table…
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
