"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setSession: (token: string, userId: string, email: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const validateAndFetchUser = useCallback(async (authToken: string, userIdHint?: string) => {
    try {
      const res = await apiFetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const userData = await res.json();
        setUser({
          id: userData.id,
          email: userData.email,
          created_at: userData.created_at,
        });
        setToken(authToken);
        localStorage.setItem("access_token", authToken);
        localStorage.setItem("user_id", userData.id);
      } else {
        // Token invalid or expired
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_id");
        setUser(null);
        setToken(null);
      }
    } catch {
      // API error or network failure
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_id");
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("access_token");
      const storedUserId = localStorage.getItem("user_id");

      if (storedToken) {
        await validateAndFetchUser(storedToken, storedUserId || undefined);
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    };

    initAuth();
  }, [validateAndFetchUser]);

  const setSession = useCallback((newToken: string, userId: string, email: string) => {
    localStorage.setItem("access_token", newToken);
    localStorage.setItem("user_id", userId);
    setToken(newToken);
    setUser({ id: userId, email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem("access_token");
    if (storedToken) {
      await validateAndFetchUser(storedToken);
    }
  }, [validateAndFetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        setSession,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
