"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  ShieldAlert, 
  Bot, 
  Sparkles, 
  X, 
  ArrowRight,
  Zap,
  Lock,
  Search
} from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();
      if (['pdf', 'docx', 'txt'].includes(ext || '')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Invalid file format. Please upload a PDF, DOCX, or TXT file.");
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a document to scan.");
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep(1);

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("enable_web_search", enableWebSearch ? "true" : "false");

    // Progress simulation interval
    const stepTimer1 = setTimeout(() => setLoadingStep(2), 1200);
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 3000);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/reports/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error: ${response.status}`);
      }

      setLoadingStep(4);
      const data = await response.json();
      setTimeout(() => {
        router.push(`/reports/${data.report_id}`);
      }, 500);

    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setError(err.message || "An unexpected error occurred during processing.");
      setLoading(false);
      setLoadingStep(0);
    }
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto py-4">
      
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" />
          <span>Next-Gen Document Intelligence</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight"
        >
          Detect Plagiarism & <br className="hidden sm:inline" />
          <span className="text-gradient">Verify AI Generation</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto"
        >
          Upload academic papers, essays, or technical documents. Get sub-second similarity matching, deep-web source extraction, and neural AI linguistic analysis.
        </motion.p>
      </div>

      {/* Main Upload Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel rounded-2xl p-6 sm:p-10 border border-slate-800/80 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          
          {/* Drag & Drop Zone */}
          <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-300 cursor-pointer ${
              dragActive 
                ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]' 
                : file 
                  ? 'border-indigo-500/50 bg-slate-900/60' 
                  : 'border-slate-700/80 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900/60'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".pdf,.docx,.txt"
            />
            
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div 
                  key="file-selected"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 max-w-xl mx-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {file.name.split('.').pop()?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition-colors"
                      title="Remove document"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="drop-prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-slate-200">
                      <span className="text-indigo-400 font-semibold hover:underline">Click to upload</span> or drag and drop document
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, and TXT (up to 20MB)</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 pt-2">
                    {['PDF', 'DOCX', 'TXT'].map((ext) => (
                      <span key={ext} className="px-2.5 py-1 rounded-md bg-slate-800 text-[11px] font-mono text-slate-400 border border-slate-700/60">
                        .{ext}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Options & Settings */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${enableWebSearch ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-200">Deep Web & Academic Index Search</p>
                <p className="text-xs text-slate-400">Cross-reference document against web sources & research repositories</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Processing Steps Loading Visualizer */}
          {loading && (
            <div className="space-y-3 p-5 rounded-xl bg-indigo-950/40 border border-indigo-500/20">
              <div className="flex items-center justify-between text-xs text-indigo-300 font-medium">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  Analyzing document structure...
                </span>
                <span>{loadingStep * 25}%</span>
              </div>
              
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400"
                  initial={{ width: "0%" }}
                  animate={{ width: `${loadingStep * 25}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-slate-400">
                <span className={loadingStep >= 1 ? "text-indigo-300 font-medium" : ""}>1. Extracting Text</span>
                <span className={loadingStep >= 2 ? "text-indigo-300 font-medium" : ""}>2. Vector Matching</span>
                <span className={loadingStep >= 3 ? "text-indigo-300 font-medium" : ""}>3. AI Perplexity Scan</span>
                <span className={loadingStep >= 4 ? "text-indigo-300 font-medium" : ""}>4. Final Report</span>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!file || loading}
            className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-white shadow-xl transition-all duration-300 ${
              !file || loading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-600/30 hover:shadow-indigo-500/50 hover:scale-[1.005]'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning Document...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-base">
                <Zap className="w-5 h-5 fill-current" />
                Run Comprehensive Analysis
                <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </button>
        </form>
      </motion.div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="glass-card p-6 rounded-2xl border border-slate-800/80 hover:border-indigo-500/40 transition-colors group">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Dual-Pass Plagiarism</h3>
          <p className="text-sm text-slate-400">
            Cross-references both internal repository files and live web results with sentence-level accuracy.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800/80 hover:border-purple-500/40 transition-colors group">
          <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Neural AI Detection</h3>
          <p className="text-sm text-slate-400">
            Detects text generated by GPT-4, Claude, Gemini, and open-weight models with confidence breakdown.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800/80 hover:border-cyan-500/40 transition-colors group">
          <div className="w-12 h-12 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Search className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Interactive Side-by-Side</h3>
          <p className="text-sm text-slate-400">
            Inspect line-by-line highlights, source attribution quotes, and instant web citation links.
          </p>
        </div>
      </div>

    </div>
  );
}
