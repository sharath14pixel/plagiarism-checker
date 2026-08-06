"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReportSummary } from "@/types";

export default function DashboardPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/reports/user/${userId}`, {
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
          throw new Error("Failed to fetch reports");
        }
        const data = await res.json();
        setReports(data);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [router]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Your Dashboard</h1>
        <p className="text-gray-500 mt-1">View and manage your recent document analysis reports.</p>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-md border border-red-100 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reports</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by analyzing a new document.</p>
          <div className="mt-6">
            <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Check Document
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {reports.map((report) => (
              <li key={report.report_id}>
                <Link href={`/reports/${report.report_id}`} className="block hover:bg-gray-50 transition-colors">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1 flex items-center">
                      <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4">
                        <div>
                          <p className="text-sm font-medium text-blue-600 truncate">{report.filename}</p>
                          <p className="mt-2 flex items-center text-sm text-gray-500">
                            <span className="truncate">{new Date(report.created_at).toLocaleString()}</span>
                          </p>
                        </div>
                        <div className="hidden md:block">
                          <div>
                            <p className="text-sm text-gray-900">
                              Plagiarism: <span className={report.plagiarism_percentage > 20 ? 'text-red-600 font-medium' : 'text-green-600'}>{report.plagiarism_percentage.toFixed(1)}%</span>
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500">
                              AI Generated: <span className={`ml-1 ${report.ai_generated_percentage > 50 ? 'text-purple-600 font-medium' : 'text-green-600'}`}>{report.ai_generated_percentage.toFixed(1)}% ({report.ai_label})</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
