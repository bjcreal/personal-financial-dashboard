"use client";

import { useQuery } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  LockOpenIcon,
  LockClosedIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/solid";
import { TransactionList } from "@/components/TransactionList";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

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

interface Account {
  id: string;
  name: string;
  nickname?: string | null;
  type: string;
  subtype?: string | null;
  mask?: string | null;
  plaidItem: {
    institutionName?: string | null;
    institutionLogo?: string | null;
  };
  transactions: Transaction[];
  downloadLogs: DownloadLog[];
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface BalanceHistory {
  id: string;
  date: string;
  current: number;
  available: number | null;
  limit: number | null;
  account: {
    name: string;
    nickname: string | null;
    type: string;
    subtype: string | null;
  };
}

interface AccountDetailsProps {
  account: Account;
}

export function AccountDetails({ account }: AccountDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [isMasked, setIsMasked] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isTransactionsExpanded, setIsTransactionsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    data: history,
    isLoading,
    refetch,
  } = useQuery<BalanceHistory[]>({
    queryKey: ["account-history", account.id],
    queryFn: () => apiGet<BalanceHistory[]>(`/api/accounts/${account.id}/history`),
  });

  useEffect(() => {
    if (history?.length) {
      setNewNickname(history[0].account.nickname || "");
    }
  }, [history]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSaveNickname = async () => {
    try {
      await apiPost(`/api/accounts/${account.id}/update-nickname`, {
        nickname: newNickname.trim() || null,
      });
      setIsEditing(false);
      refetch();
    } catch (error) {
      console.error("Error updating nickname:", error);
    }
  };

  const handleCancelEditing = () => {
    setNewNickname(history?.[0].account.nickname || "");
    setIsEditing(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await handleSaveNickname();
    }
  };

  const formatBalance = (amount: number | null) => {
    if (amount === null) return "-";
    return isMasked ? "••••••" : `$${amount.toFixed(2)}`;
  };

  const handleDeleteBalance = async (balanceId: string) => {
    if (!confirm("Are you sure you want to delete this record?")) {
      return;
    }

    try {
      await apiDelete(`/api/accounts/${account.id}/history/${balanceId}`);
      refetch();
    } catch (error) {
      console.error("Error deleting balance record:", error);
    }
  };

  const handleBackfill = async () => {
    if (
      !confirm(
        "Are you sure you want to backfill missing monthly data?  This will create monthly balances for all months in the account's history that are missing and going back to 2022-12-01 using the oldest balance amount as the starting point.  This is to ensure net worth is calculated correctly."
      )
    ) {
      return;
    }

    try {
      const result = await apiPost<{ message: string }>(`/api/accounts/${account.id}/backfill`);
      alert(result.message);
      refetch();
    } catch (error) {
      console.error("Error backfilling data:", error);
      alert(error instanceof Error ? error.message : "Failed to backfill data");
    }
  };

  const handleCleanMonthlyRecords = async () => {
    if (
      !confirm(
        "Are you sure you want to delete duplicate monthly records? This will keep only the most recent record for each month."
      )
    ) {
      return;
    }

    try {
      const result = await apiPost<{ message: string }>(`/api/accounts/${account.id}/clean-monthly-records`);
      alert(result.message);
      refetch();
    } catch (error) {
      console.error("Error cleaning monthly records:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to clean monthly records"
      );
    }
  };

  const handleCleanDailyRecords = async () => {
    if (
      !confirm(
        "Are you sure you want to delete duplicate daily records? This will keep only the most recent record for each day."
      )
    ) {
      return;
    }

    try {
      const result = await apiPost<{ message: string }>(`/api/accounts/${account.id}/clean-daily-records`);
      alert(result.message);
      refetch();
    } catch (error) {
      console.error("Error cleaning daily records:", error);
      alert(
        error instanceof Error ? error.message : "Failed to clean daily records"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-[400px] bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="max-w-7xl mx-auto">
        <p>No history found for this account.</p>
      </div>
    );
  }

  // Reverse the data for the chart to show progression over time
  const chartData = {
    labels: [...history]
      .reverse()
      .map((item) => format(new Date(item.date), "MMM d, yyyy")),
    datasets: isMasked
      ? [
          {
            label: "Balance History",
            data: new Array(history.length).fill(0),
            borderColor: "rgb(156, 163, 175)",
            backgroundColor: "rgba(156, 163, 175, 0.5)",
            tension: 0.1,
          },
        ]
      : [
          {
            label: "Current Balance",
            data: [...history].reverse().map((item) => item.current),
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.5)",
            tension: 0.1,
          },
          ...(history.some((item) => item.available !== null)
            ? [
                {
                  label: "Available Balance",
                  data: [...history].reverse().map((item) => item.available),
                  borderColor: "rgb(34, 197, 94)",
                  backgroundColor: "rgba(34, 197, 94, 0.5)",
                  tension: 0.1,
                },
              ]
            : []),
        ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Balance History",
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem: TooltipItem<"line">) {
            if (isMasked) return "••••••";
            const label = tooltipItem.dataset.label || "";
            const value = tooltipItem.raw as number;
            return `${label}: $${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function (value) {
            if (isMasked) return "••••••";
            return `$${value.toLocaleString()}`;
          },
        },
      },
    },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Institution and Account Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4">
          {account.plaidItem.institutionLogo ? (
            <img
              src={account.plaidItem.institutionLogo}
              alt={account.plaidItem.institutionName || "Bank logo"}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <BuildingLibraryIcon className="w-12 h-12 text-gray-400" />
          )}
          <div>
            <div className="text-sm text-gray-500">
              {account.plaidItem.institutionName}
            </div>
            <div className="flex items-start gap-2">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-3xl font-bold px-2 py-1 border rounded"
                    placeholder={account.name}
                  />
                  <button
                    onClick={handleSaveNickname}
                    className="p-2 text-green-600 hover:text-green-700"
                    title="Save nickname"
                  >
                    <CheckIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handleCancelEditing}
                    className="p-2 text-red-600 hover:text-red-700"
                    title="Cancel"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">
                    {account.nickname || account.name}
                    {account.nickname && (
                      <span className="text-gray-500 text-lg ml-2">
                        ({account.name})
                      </span>
                    )}
                  </h1>
                  <button
                    onClick={handleStartEditing}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Edit nickname"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            {account.mask && (
              <div className="text-sm text-gray-500">
                Account ending in {account.mask}
              </div>
            )}
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setIsMasked(!isMasked)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title={
                isMasked
                  ? "Show sensitive information"
                  : "Hide sensitive information"
              }
            >
              {isMasked ? (
                <LockClosedIcon className="w-5 h-5" />
              ) : (
                <LockOpenIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Balance History Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Balance History
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleBackfill}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="Fill in missing monthly data points"
              >
                Backfill Data
              </button>
              <button
                onClick={handleCleanDailyRecords}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                title="Keep only the most recent record for each day"
              >
                Clean Daily Records
              </button>
              <button
                onClick={handleCleanMonthlyRecords}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                title="Keep only the most recent record for each month"
              >
                Clean Monthly Records
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <Line options={chartOptions} data={chartData} />

          <div className="mt-6">
            <div
              className="flex justify-between items-center px-6 py-3 bg-gray-50 border-y border-gray-200 cursor-pointer"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            >
              <h3 className="text-sm font-medium text-gray-500">
                Balance History Records
              </h3>
              {isHistoryExpanded ? (
                <ChevronUpIcon className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-gray-500" />
              )}
            </div>

            {isHistoryExpanded && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Available Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(item.date), "MMM d, yyyy h:mm a")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatBalance(item.current)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatBalance(item.available)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => handleDeleteBalance(item.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Delete record"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <TransactionList
        accountId={account.id}
        initialTransactions={account.transactions}
        downloadLogs={account.downloadLogs}
      />
    </div>
  );
}
