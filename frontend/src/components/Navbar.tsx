"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  UploadCloud, 
  LayoutDashboard, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Sparkles,
  FileText
} from "lucide-react";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("access_token");
      setIsLoggedIn(!!token);
    };

    checkAuth();
    // Listen to storage changes in case of multi-tab login/logout
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    setIsLoggedIn(false);
    router.push("/login");
  };

  return (
    <nav className="glass-panel sticky top-0 z-50 border-b border-slate-800/80 shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Brand Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                  DocuShield<span className="text-indigo-400 font-medium text-base ml-0.5">.ai</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase flex items-center gap-1 -mt-1">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-400 inline" /> Neural Scan
                </span>
              </div>
            </Link>

            {/* Navigation Tabs (Logged In) */}
            {isLoggedIn && (
              <div className="hidden md:flex items-center space-x-1 ml-6 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                <Link 
                  href="/" 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname === "/" 
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/50" 
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Scan</span>
                </Link>
                <Link 
                  href="/dashboard" 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname === "/dashboard" 
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/50" 
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
              </div>
            )}
          </div>

          {/* Right Action Menu */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-mono text-slate-300">Session Active</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-slate-300 hover:text-rose-400 bg-slate-900/80 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-800/50 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
                  title="Sign out of account"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link 
                  href="/login" 
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 px-4 py-2 rounded-xl text-sm font-medium transition-all border border-transparent hover:border-slate-700"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log in</span>
                </Link>
                <Link 
                  href="/signup" 
                  className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md shadow-indigo-600/30 hover:shadow-indigo-500/50 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Get Started</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
