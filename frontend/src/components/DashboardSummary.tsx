"use client";

import { Account } from "@/types/account";

interface DashboardSummaryProps {
  accounts: Account[];
  isMasked?: boolean;
}

export function DashboardSummary({
  accounts,
  isMasked = false,
}: DashboardSummaryProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  // Log the number of accounts being processed
  console.log(`Processing ${accounts.length} accounts for DashboardSummary`);

  const summary = accounts.reduce(
    (acc, account) => {
      const type = account.type.toLowerCase();
      const balance = account.balance.current;

      if (type === "credit" || type === "loan") {
        acc.totalLiabilities += Math.abs(balance);
      } else {
        acc.totalAssets += balance;
      }

      if (type === "credit") {
        acc.totalCredit += account.balance.limit || 0;
        acc.usedCredit += Math.abs(balance);
      }

      return acc;
    },
    {
      totalAssets: 0,
      totalLiabilities: 0,
      totalCredit: 0,
      usedCredit: 0,
    }
  );

  const netWorth = summary.totalAssets - summary.totalLiabilities;
  const creditUtilization = summary.totalCredit
    ? (summary.usedCredit / summary.totalCredit) * 100
    : 0;

  // Log the financial summary for debugging
  console.log("DashboardSummary calculated values:");
  console.log(`  Net Worth: ${netWorth.toLocaleString()}`);
  console.log(`  Total Assets: ${summary.totalAssets.toLocaleString()}`);
  console.log(
    `  Total Liabilities: ${summary.totalLiabilities.toLocaleString()}`
  );
  console.log(`  Credit Utilization: ${creditUtilization.toFixed(1)}%`);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500">Net Worth</h3>
        <p
          className={`text-2xl font-bold ${
            netWorth >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatBalance(netWorth)}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500">Total Assets</h3>
        <p className="text-2xl font-bold text-gray-900">
          {formatBalance(summary.totalAssets)}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500">Total Liabilities</h3>
        <p className="text-2xl font-bold text-gray-900">
          {formatBalance(summary.totalLiabilities)}
        </p>
      </div>

      {!isMasked && (
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500">
            Credit Utilization
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {creditUtilization.toFixed(1)}%
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                creditUtilization > 30 ? "bg-red-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(creditUtilization, 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
