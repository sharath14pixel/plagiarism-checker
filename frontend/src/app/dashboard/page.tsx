"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ReportSummary } from "@/types";
import { 
  FileText, 
  Search, 
  UploadCloud, 
  ShieldAlert, 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  BarChart3,
  ChevronRight,
  Filter
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function DashboardPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRisk, setFilterRisk] = useState<"all" | "high" | "moderate" | "clean">("all");
  
  const router = useRouter();

  useEffect(() => {
    const fetchReports = async () => {
      const token = localStorage.getItem("access_token");
      const userId = localStorage.getItem("user_id");
      
      if (!token || !userId) {
        router.push("/login");
        return;
      }
      try {
        const res = await apiFetch(`/reports/user/${userId}`, {
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
          throw new Error("Failed to fetch document reports");
        }
        const data = await res.json();
        setReports(data);
      } catch (err: any) {
        setError(err.message || "An error occurred fetching dashboard reports.");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [router]);

  // Derived stats
  const totalReports = reports.length;
  const avgPlagiarism = totalReports 
    ? (reports.reduce((acc, r) => acc + r.plagiarism_percentage, 0) / totalReports).toFixed(1)
    : "0.0";
  const highRiskCount = reports.filter(r => r.plagiarism_percentage > 25 || r.ai_generated_percentage > 50).length;

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch = r.filename.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterRisk === "high") {
      return matchesSearch && (r.plagiarism_percentage > 25 || r.ai_generated_percentage > 50);
    }
    if (filterRisk === "moderate") {
      return matchesSearch && ((r.plagiarism_percentage >= 10 && r.plagiarism_percentage <= 25) || (r.ai_generated_percentage >= 20 && r.ai_generated_percentage <= 50));
    }
    if (filterRisk === "clean") {
      return matchesSearch && r.plagiarism_percentage < 10 && r.ai_generated_percentage < 20;
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Manage and inspect your previously analyzed documents.</p>
        </div>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-600/30 transition-all self-start md:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>New Document Scan</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Scans</p>
            <p className="text-2xl font-bold text-white mt-1">{totalReports}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Avg Similarity</p>
            <p className="text-2xl font-bold text-white mt-1">{avgPlagiarism}%</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">High Risk Flags</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{highRiskCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-sm outline-none"
          />
        </div>

        {/* Filter Risk Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 hidden sm:inline" />
          {(["all", "high", "moderate", "clean"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all capitalize ${
                filterRisk === r 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Reports Content List */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredReports.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel text-center py-16 px-6 rounded-2xl border border-slate-800/80 max-w-lg mx-auto space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-slate-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">No Reports Found</h3>
            <p className="text-slate-400 text-sm mt-1">
              {searchQuery || filterRisk !== "all" 
                ? "No document matches your search criteria." 
                : "You haven't scanned any documents yet."}
            </p>
          </div>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Scan First Document</span>
          </Link>
        </motion.div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden divide-y divide-slate-800/60 shadow-xl">
          {filteredReports.map((report) => {
            const isHighRisk = report.plagiarism_percentage > 25 || report.ai_generated_percentage > 50;
            const isModerateRisk = !isHighRisk && (report.plagiarism_percentage >= 10 || report.ai_generated_percentage >= 20);

            return (
              <motion.div 
                key={report.report_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Link 
                  href={`/reports/${report.report_id}`} 
                  className="block p-5 hover:bg-slate-900/60 transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left File Information */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`p-3 rounded-xl border shrink-0 ${
                        isHighRisk 
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : isModerateRisk 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      }`}>
                        <FileText className="w-6 h-6" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors truncate max-w-sm">
                            {report.filename}
                          </h3>

                          {/* Risk Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${
                            isHighRisk
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : isModerateRisk
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          }`}>
                            {isHighRisk ? 'High Risk' : isModerateRisk ? 'Moderate' : 'Clean'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{new Date(report.created_at).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right Metrics & Arrow */}
                    <div className="flex items-center gap-6 self-end md:self-auto">
                      <div className="flex items-center gap-5 text-xs">
                        
                        {/* Plagiarism Pill */}
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Similarity</span>
                          <span className={`font-bold text-sm ${
                            report.plagiarism_percentage > 20 ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {report.plagiarism_percentage.toFixed(1)}%
                          </span>
                        </div>

                        {/* AI Pill */}
                        <div className="text-right border-l border-slate-800 pl-5">
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">AI Probability</span>
                          <span className={`font-bold text-sm ${
                            report.ai_generated_percentage > 50 ? 'text-purple-400' : 'text-emerald-400'
                          }`}>
                            {report.ai_generated_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>

                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

    </div>
  );
}
