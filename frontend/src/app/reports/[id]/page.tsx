"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CombinedReport } from "@/types";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [report, setReport] = useState<CombinedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          throw new Error("Failed to fetch report");
        }
        const data = await res.json();
        setReport(data);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [unwrappedParams.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-red-50 p-6 rounded-lg border border-red-100 text-red-700">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p>{error || "Report not found"}</p>
        <Link href="/" className="inline-block mt-4 text-blue-600 hover:underline">
          &larr; Back to home
        </Link>
      </div>
    );
  }

  // Helper to render the text with highlights
  const renderHighlightedText = () => {
    if (!report.full_text) return <p>No text available.</p>;

    // We will do a simple string replacement approach for highlighting.
    // In a real app, this would need careful index-based tracking to avoid replacing HTML tags.
    // For this minimal requirement, we'll split by sentences or just find exact matches.
    
    // Create an array of text segments and their types
    let segments = [{ text: report.full_text, type: "normal", source: "" }];

    // Highlight Plagiarism
    report.matched_sources.forEach((match) => {
      const newSegments: typeof segments = [];
      segments.forEach((seg) => {
        if (seg.type !== "normal") {
          newSegments.push(seg);
          return;
        }
        
        const parts = seg.text.split(match.text);
        parts.forEach((part, i) => {
          if (part) newSegments.push({ text: part, type: "normal", source: "" });
          if (i < parts.length - 1) {
            newSegments.push({ text: match.text, type: "plagiarism", source: match.source });
          }
        });
      });
      segments = newSegments;
    });

    // Highlight AI
    report.ai_flagged_segments.forEach((match) => {
      const newSegments: typeof segments = [];
      segments.forEach((seg) => {
        if (seg.type !== "normal") {
          newSegments.push(seg);
          return;
        }
        
        // Use a simple substring search since text might be slightly different
        const parts = seg.text.split(match.text);
        parts.forEach((part, i) => {
          if (part) newSegments.push({ text: part, type: "normal", source: "" });
          if (i < parts.length - 1) {
            newSegments.push({ text: match.text, type: "ai", source: `Confidence: ${match.confidence.toFixed(1)}%` });
          }
        });
      });
      segments = newSegments;
    });

    return (
      <div className="whitespace-pre-wrap font-serif leading-relaxed text-gray-800">
        {segments.map((seg, i) => {
          if (seg.type === "plagiarism") {
            return (
              <span key={i} className="bg-red-200 text-red-900 px-1 rounded cursor-help" title={`Source: ${seg.source}`}>
                {seg.text}
              </span>
            );
          }
          if (seg.type === "ai") {
            return (
              <span key={i} className="bg-purple-200 text-purple-900 px-1 rounded cursor-help" title={seg.source}>
                {seg.text}
              </span>
            );
          }
          return <span key={i}>{seg.text}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analysis Report</h1>
          <p className="text-gray-500 mt-1">File: <span className="font-medium text-gray-700">{report.filename}</span></p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>Created: {new Date(report.created_at).toLocaleString()}</p>
          <p>{report.word_count} words • {report.total_chunks} segments</p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plagiarism Score */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={report.plagiarism_percentage > 20 ? "text-red-500" : "text-green-500"}
                strokeDasharray={`${report.plagiarism_percentage}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xl font-bold">{report.plagiarism_percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Plagiarism Score</h3>
            <p className="text-sm text-gray-500 mt-1">
              {report.internal_percentage > 0 && <span>Internal: {report.internal_percentage.toFixed(1)}%<br/></span>}
              {report.web_percentage > 0 && <span>Web: {report.web_percentage.toFixed(1)}%</span>}
            </p>
          </div>
        </div>

        {/* AI Score */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={report.ai_generated_percentage > 50 ? "text-purple-500" : "text-green-500"}
                strokeDasharray={`${report.ai_generated_percentage}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xl font-bold">{report.ai_generated_percentage.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Probability</h3>
            <p className="text-sm font-medium mt-1 uppercase tracking-wide px-2 py-1 inline-block rounded bg-gray-100">
              {report.ai_label}
            </p>
          </div>
        </div>
      </div>

      {/* Document Text */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Document Text</h3>
          <div className="flex space-x-4 text-sm">
            <span className="flex items-center"><span className="w-3 h-3 bg-red-200 inline-block rounded mr-1"></span> Plagiarized</span>
            <span className="flex items-center"><span className="w-3 h-3 bg-purple-200 inline-block rounded mr-1"></span> AI-Generated</span>
          </div>
        </div>
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {renderHighlightedText()}
        </div>
      </div>

      {/* Matched Sources */}
      {report.matched_sources.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Matched Sources</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {report.matched_sources.map((source, idx) => (
              <div key={idx} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded uppercase ${source.type === 'web' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                      {source.type}
                    </span>
                    <span className="font-medium text-gray-900">Similarity: {source.similarity.toFixed(1)}%</span>
                  </div>
                </div>
                {source.type === 'web' ? (
                  <a href={source.source} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all font-mono">
                    {source.source}
                  </a>
                ) : (
                  <p className="text-sm font-mono text-gray-600">{source.source}</p>
                )}
                <p className="mt-3 text-sm text-gray-700 italic border-l-4 border-gray-300 pl-3">
                  "{source.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
