import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DocuShield AI | Advanced Plagiarism & AI Content Inspector",
  description: "Enterprise-grade plagiarism detection and AI content verification for documents, papers, and manuscripts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-mesh-pattern text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white`}>
        <AuthProvider>
          <div className="fixed inset-0 bg-grid-pattern opacity-60 pointer-events-none z-0" />
          <Navbar />
          <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
            {children}
          </main>
          <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500 relative z-10">
            <p>© {new Date().getFullYear()} DocuShield AI Document Intelligence. All rights reserved.</p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
