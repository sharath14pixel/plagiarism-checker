"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CombinedReport } from "@/types";
import { 
  ArrowLeft, 
  FileText, 
  Globe, 
  ShieldAlert, 
  Bot, 
  Clock, 
  ExternalLink, 
  Filter, 
  Printer, 
  Sparkles, 
  Layers,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [report, setReport] = useState<CombinedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "plagiarism" | "ai" | "clean">("all");
  const [activeSourceIndex, setActiveSourceIndex] = useState<number | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    const fetchReport = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/reports/${unwrappedParams.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (res.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        if (!res.ok) {
          throw new Error("Report not found or access denied.");
        }
        const data = await res.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message || "An error occurred fetching report details.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [unwrappedParams.id, router]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm animate-pulse">Loading inspection report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-rose-500/20 text-rose-300 max-w-lg mx-auto text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Report Unavailable</h2>
        <p className="text-sm text-slate-300">{error || "The requested analysis report could not be found."}</p>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  // Segment analysis & highlighting logic
  const renderHighlightedText = () => {
    if (!report.full_text) return <p className="text-slate-500 italic">No document text content available.</p>;

    let segments = [{ text: report.full_text, type: "normal", source: "", confidence: 0 }];

    // Highlight Plagiarism matches
    report.matched_sources.forEach((match) => {
      const newSegments: typeof segments = [];
      segments.forEach((seg) => {
        if (seg.type !== "normal") {
          newSegments.push(seg);
          return;
        }
        
        const parts = seg.text.split(match.text);
        parts.forEach((part, i) => {
          if (part) newSegments.push({ text: part, type: "normal", source: "", confidence: 0 });
          if (i < parts.length - 1) {
            newSegments.push({ text: match.text, type: "plagiarism", source: match.source, confidence: match.similarity });
          }
        });
      });
      segments = newSegments;
    });

    // Highlight AI flagged segments
    report.ai_flagged_segments.forEach((match) => {
      const newSegments: typeof segments = [];
      segments.forEach((seg) => {
        if (seg.type !== "normal") {
          newSegments.push(seg);
          return;
        }
        
        const parts = seg.text.split(match.text);
        parts.forEach((part, i) => {
          if (part) newSegments.push({ text: part, type: "normal", source: "", confidence: 0 });
          if (i < parts.length - 1) {
            newSegments.push({ text: match.text, type: "ai", source: `AI Probability: ${match.confidence.toFixed(1)}%`, confidence: match.confidence });
          }
        });
      });
      segments = newSegments;
    });

    return (
      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-200 selection:bg-indigo-500 selection:text-white">
        {segments.map((seg, i) => {
          const isPlagiarism = seg.type === "plagiarism";
          const isAi = seg.type === "ai";

          // Apply display filter
          if (filterMode === "plagiarism" && !isPlagiarism) return <span key={i} className="opacity-30">{seg.text}</span>;
          if (filterMode === "ai" && !isAi) return <span key={i} className="opacity-30">{seg.text}</span>;
          if (filterMode === "clean" && (isPlagiarism || isAi)) return null;

          if (isPlagiarism) {
            return (
              <mark 
                key={i} 
                className="bg-rose-500/20 text-rose-200 border-b-2 border-rose-500 px-1 py-0.5 rounded cursor-help transition-all hover:bg-rose-500/30"
                title={`Plagiarized Match (${seg.confidence.toFixed(1)}% similarity) - ${seg.source}`}
              >
                {seg.text}
              </mark>
            );
          }
          if (isAi) {
            return (
              <mark 
                key={i} 
                className="bg-purple-500/20 text-purple-200 border-b-2 border-purple-500 px-1 py-0.5 rounded cursor-help transition-all hover:bg-purple-500/30"
                title={seg.source}
              >
                {seg.text}
              </mark>
            );
          }
          return <span key={i}>{seg.text}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      
      {/* Back & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard" 
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate max-w-md sm:max-w-xl">
              {report.filename}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {new Date(report.created_at).toLocaleString()}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-500" />
                {report.word_count} words ({report.total_chunks} blocks)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Export / Print</span>
          </button>
        </div>
      </div>

      {/* Scorecards Donut Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Plagiarism Donut Card */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800/80 flex items-center gap-6 relative overflow-hidden">
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={report.plagiarism_percentage > 20 ? "text-rose-500" : "text-emerald-400"}
                strokeDasharray={`${report.plagiarism_percentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white tracking-tight">{report.plagiarism_percentage.toFixed(1)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-5 h-5 ${report.plagiarism_percentage > 20 ? 'text-rose-400' : 'text-emerald-400'}`} />
              <h3 className="text-lg font-bold text-white">Similarity Score</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Overall matched content across repositories.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-slate-300 font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                Web: <strong className="text-indigo-400">{report.web_percentage.toFixed(1)}%</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                Internal: <strong className="text-amber-400">{report.internal_percentage.toFixed(1)}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* AI Donut Card */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800/80 flex items-center gap-6 relative overflow-hidden">
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={report.ai_generated_percentage > 50 ? "text-purple-500" : "text-emerald-400"}
                strokeDasharray={`${report.ai_generated_percentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white tracking-tight">{report.ai_generated_percentage.toFixed(1)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className={`w-5 h-5 ${report.ai_generated_percentage > 50 ? 'text-purple-400' : 'text-emerald-400'}`} />
              <h3 className="text-lg font-bold text-white">AI Generation</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Linguistic perplexity & burstiness evaluation.
            </p>
            <div className="pt-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold uppercase tracking-wider">
                {report.ai_label}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Document Inspector */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        
        {/* Document Header Controls & Filter Pills */}
        <div className="bg-slate-900/90 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-base">Document Content Inspector</h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 hidden sm:inline" />
            
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterMode === "all" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              All Text
            </button>
            <button
              onClick={() => setFilterMode("plagiarism")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterMode === "plagiarism" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              Plagiarized ({report.matched_sources.length})
            </button>
            <button
              onClick={() => setFilterMode("ai")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterMode === "ai" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              AI Flagged ({report.ai_flagged_segments.length})
            </button>
          </div>
        </div>

        {/* Text Container */}
        <div className="p-6 sm:p-8 max-h-[600px] overflow-y-auto bg-slate-950/60">
          {renderHighlightedText()}
        </div>

      </div>

      {/* Matched Evidence Sources Drawer */}
      {report.matched_sources.length > 0 && (
        <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
          <div className="bg-slate-900/90 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <span>Matched Sources & Citation Evidence</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {report.matched_sources.length} matched reference{report.matched_sources.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {report.matched_sources.map((source, idx) => (
              <div key={idx} className="p-6 hover:bg-slate-900/40 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded border ${
                      source.type === 'web' 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' 
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}>
                      {source.type}
                    </span>
                    <span className="text-xs text-slate-300 font-semibold">
                      Match Similarity: <span className="text-rose-400">{source.similarity.toFixed(1)}%</span>
                    </span>
                  </div>

                  {source.type === 'web' && (
                    <a 
                      href={source.source} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-mono truncate max-w-md"
                    >
                      <span className="truncate">{source.source}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 italic font-mono leading-relaxed border-l-4 border-l-rose-500">
                  "{source.text}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
