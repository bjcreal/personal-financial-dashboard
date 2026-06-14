"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { apiPost, apiDelete } from "@/lib/api";

interface Transaction {
  id: string;
  date: string;
  name: string;
  amount: number;
  category?: string | null;
  pending: boolean;
}

interface DownloadLog {
  id: string;
  createdAt: string;
  numTransactions: number;
  status: string;
}

interface TransactionListProps {
  accountId: string;
  initialTransactions: Transaction[];
  downloadLogs: DownloadLog[];
}

export function TransactionList({
  accountId,
  initialTransactions,
  downloadLogs,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await apiPost(`/api/accounts/${accountId}/transactions`);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL transactions and download logs? This cannot be undone."
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiDelete(`/api/accounts/${accountId}/transactions`);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAll}
              disabled={isLoading}
              className={`px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Delete all transactions and download logs"
            >
              Delete All
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Downloading..." : "Download Transactions"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 px-6 py-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Transactions Table */}
        <div>
          <div
            className="flex justify-between items-center px-6 py-3 bg-gray-50 border-y border-gray-200 cursor-pointer"
            onClick={() => setIsTableExpanded(!isTableExpanded)}
          >
            <h3 className="text-sm font-medium text-gray-500">
              Transaction Records
            </h3>
            {isTableExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {isTableExpanded && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.name}
                          {transaction.pending && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {transaction.category || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          <span
                            className={
                              transaction.amount < 0
                                ? "text-red-600"
                                : "text-green-600"
                            }
                          >
                            ${Math.abs(transaction.amount).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Download History */}
        <div className="mt-6">
          <div className="flex justify-between items-center px-6 py-3 bg-gray-50 border-y border-gray-200">
            <h3 className="text-sm font-medium text-gray-500">
              Download History
            </h3>
          </div>
          <div className="mt-4 px-6">
            {downloadLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No previous downloads</p>
            ) : (
              <ul className="space-y-2">
                {downloadLogs.slice(0, 5).map((log) => (
                  <li
                    key={log.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>
                      {new Date(log.createdAt).toLocaleDateString()} -{" "}
                      {log.numTransactions} transactions
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        log.status === "success"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {log.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
