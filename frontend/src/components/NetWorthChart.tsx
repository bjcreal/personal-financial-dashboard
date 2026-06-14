"use client";

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
} from "chart.js";
import { format, compareAsc } from "date-fns";
import { Account } from "@/types/account";

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

interface NetWorthChartProps {
  accounts: Account[];
  isMasked?: boolean;
}

export function NetWorthChart({
  accounts,
  isMasked = false,
}: NetWorthChartProps) {
  const formatBalance = (amount: number) => {
    return isMasked ? "••••••" : `$${amount.toLocaleString()}`;
  };

  // Create a map to store net worth by month
  const monthlyNetWorth = new Map<string, number>();

  // Debug: List all accounts
  console.log(`Processing ${accounts.length} accounts for NetWorthChart`);

  // Keep track of account contributions to the latest month's net worth
  const latestMonthContributions: Record<string, number> = {};
  let latestMonth = "";

  // Process each account
  accounts.forEach((account) => {
    const isLiability =
      account.type.toLowerCase() === "credit" ||
      account.type.toLowerCase() === "loan";
    const multiplier = isLiability ? -1 : 1;

    if (account.balances && account.balances.length > 0) {
      console.log(
        `Account: ${account.name} (${account.type}) has ${account.balances.length} balance entries`
      );

      // Process historical balances
      account.balances.forEach((balance) => {
        // Ensure we have a valid date and current balance
        if (!balance.date) {
          console.warn(`Missing date for account ${account.name}:`, balance);
          return;
        }

        const current = balance.current;
        if (current === null || current === undefined) {
          console.warn(
            `Missing current balance for account ${account.name} on ${balance.date}:`,
            balance
          );
          return;
        }

        if (!isFinite(current)) {
          console.warn(
            `Invalid balance value for account ${account.name} on ${balance.date}:`,
            current
          );
          return;
        }

        const monthKey = format(new Date(balance.date), "yyyy-MM");
        const currentValue = monthlyNetWorth.get(monthKey) || 0;
        const newValue = currentValue + current * multiplier;

        // Track the contribution to the latest month
        if (!latestMonth || monthKey > latestMonth) {
          latestMonth = monthKey;
        }

        if (monthKey === latestMonth) {
          latestMonthContributions[account.name] = current * multiplier;
        }

        if (!isFinite(newValue)) {
          console.warn(
            `Invalid calculation result for ${account.name} on ${monthKey}:`,
            {
              currentValue,
              current,
              multiplier,
              newValue,
            }
          );
          return;
        }

        monthlyNetWorth.set(monthKey, newValue);
      });
    } else {
      console.log(
        `Account: ${account.name} (${account.type}) has no balance history`
      );
    }
  });

  // Convert to array and sort by date
  const sortedData = Array.from(monthlyNetWorth.entries())
    .map(([monthKey, value]) => ({
      date: new Date(monthKey + "-01"), // Convert YYYY-MM to date
      netWorth: value,
    }))
    .sort((a, b) => compareAsc(a.date, b.date));

  // Log detailed information about the latest month
  if (latestMonth) {
    const latestNetWorth = monthlyNetWorth.get(latestMonth) || 0;
    console.log(
      `Latest month: ${latestMonth}, Net Worth: ${latestNetWorth.toLocaleString()}`
    );
    console.log("Contributions to latest month's net worth:");

    // Sort by absolute contribution value (highest first)
    const sortedContributions = Object.entries(latestMonthContributions).sort(
      (a, b) => Math.abs(b[1]) - Math.abs(a[1])
    );

    sortedContributions.forEach(([account, value]) => {
      console.log(
        `  ${account}: ${value.toLocaleString()} (${(
          (value / latestNetWorth) *
          100
        ).toFixed(1)}%)`
      );
    });
  }

  const chartData = {
    labels: sortedData.map((item) => format(item.date, "MMM yyyy")),
    datasets: [
      {
        label: "Net Worth",
        data: sortedData.map((item) => item.netWorth),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.5)",
        tension: 0.1,
      },
    ],
  };

  // Debug: Log the chart data points
  console.log("Net Worth Chart Data Points:");
  sortedData.forEach((item, index) => {
    if (index === 0 || index === sortedData.length - 1 || index % 3 === 0) {
      console.log(
        `  ${format(item.date, "MMM yyyy")}: ${item.netWorth.toLocaleString()}`
      );
    }
  });

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "Net Worth Over Time",
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw as number;
            return `Net Worth: ${formatBalance(value)}`;
          },
        },
      },
    },
    scales: {
      y: {
        type: "linear",
        beginAtZero: false,
        grace: "5%",
        ticks: {
          callback: (value) => formatBalance(value as number),
          maxTicksLimit: 10,
        },
      },
      x: {
        grid: {
          display: true,
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-[400px] flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Net Worth Over Time</h2>
      <div className="flex-1">
        <Line options={chartOptions} data={chartData} />
      </div>
    </div>
  );
}
