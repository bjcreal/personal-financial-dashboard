"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Account {
  id: string;
  type: string;
  subtype: string | null;
  balance: {
    current: number;
  };
}

interface AccountTypeChartProps {
  accounts: Account[];
  isMasked?: boolean;
}

const typeColors = {
  depository: "rgba(16, 185, 129, 0.7)", // Green
  credit: "rgba(239, 68, 68, 0.7)", // Red
  investment: "rgba(139, 92, 246, 0.7)", // Purple
  loan: "rgba(245, 158, 11, 0.7)", // Orange
  brokerage: "rgba(14, 165, 233, 0.7)", // Sky Blue
  other: "rgba(107, 114, 128, 0.7)", // Gray
};

export function AccountTypeChart({
  accounts,
  isMasked = false,
}: AccountTypeChartProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  const accountTypes = accounts.reduce((acc, account) => {
    const type = account.type.toLowerCase();
    if (!acc[type]) {
      acc[type] = 0;
    }
    acc[type] += account.balance.current;
    return acc;
  }, {} as Record<string, number>);

  const totalBalance = Object.values(accountTypes).reduce(
    (sum, balance) => sum + balance,
    0
  );

  const chartData = {
    labels: ["Account Types"],
    datasets: Object.entries(accountTypes)
      .map(([type, balance]) => ({
        label: type.charAt(0).toUpperCase() + type.slice(1),
        data: [balance],
        backgroundColor:
          typeColors[type as keyof typeof typeColors] || typeColors.other,
      }))
      .sort((a, b) => b.data[0] - a.data[0]),
  };

  const chartOptions = {
    responsive: true,
    scales: {
      x: {
        stacked: false,
      },
      y: {
        stacked: false,
        beginAtZero: true,
        ticks: {
          callback: (value: number) => formatBalance(value),
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: { raw: number; dataset: { label: string } }) => {
            const value = context.raw;
            const percentage = ((value / totalBalance) * 100).toFixed(1);
            return `${context.dataset.label}: ${formatBalance(
              Math.abs(value)
            )} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-[400px] flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Balance by Account Type</h2>
      <div className="flex-1">
        <Bar options={chartOptions} data={chartData} />
      </div>
    </div>
  );
}
