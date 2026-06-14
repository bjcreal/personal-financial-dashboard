"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { getFinancialGroup } from "@/lib/accountTypes";

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

interface Account {
  id: string;
  type: string;
  subtype: string | null;
  balance: {
    current: number;
  };
}

interface FinancialGroupChartProps {
  accounts: Account[];
  isMasked?: boolean;
}

export function FinancialGroupChart({
  accounts,
  isMasked = false,
}: FinancialGroupChartProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  const groupData = accounts.reduce(
    (acc, account) => {
      const group = getFinancialGroup(account.type);
      if (group === "Liabilities") {
        acc.liabilities += Math.abs(account.balance.current);
      } else {
        acc.assets += account.balance.current;
      }
      return acc;
    },
    { assets: 0, liabilities: 0 }
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Financial Groups</h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Assets</span>
            <span className="text-sm font-medium text-green-600">
              {formatBalance(groupData.assets)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{
                width: `${Math.min(
                  (groupData.assets /
                    Math.max(groupData.assets, groupData.liabilities)) *
                    100,
                  100
                )}%`,
              }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Liabilities</span>
            <span className="text-sm font-medium text-red-600">
              {formatBalance(groupData.liabilities)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-red-500"
              style={{
                width: `${Math.min(
                  (groupData.liabilities /
                    Math.max(groupData.assets, groupData.liabilities)) *
                    100,
                  100
                )}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
