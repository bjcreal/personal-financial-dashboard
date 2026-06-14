import React from "react";
import { render, screen } from "@testing-library/react";
import { DashboardSummary } from "@/components/DashboardSummary";
import type { Account } from "@/types/account";

function makeAccount(overrides: Partial<Account> & { id: string }): Account {
  return {
    id: overrides.id,
    name: overrides.name ?? "Test Account",
    type: overrides.type ?? "depository",
    subtype: overrides.subtype ?? "checking",
    balance: overrides.balance ?? { current: 0 },
    hidden: false,
    ...overrides,
  };
}

const checkingAccount = makeAccount({
  id: "a1",
  name: "Checking",
  type: "depository",
  balance: { current: 5000 },
});

const savingsAccount = makeAccount({
  id: "a2",
  name: "Savings",
  type: "depository",
  balance: { current: 10000 },
});

const creditAccount = makeAccount({
  id: "a3",
  name: "Visa",
  type: "credit",
  subtype: "credit card",
  balance: { current: -500, limit: 2000 },
});

const loanAccount = makeAccount({
  id: "a4",
  name: "Auto Loan",
  type: "loan",
  subtype: "auto",
  balance: { current: -8000 },
});

describe("DashboardSummary", () => {
  it("renders zero values with no accounts", () => {
    render(<DashboardSummary accounts={[]} />);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
    expect(screen.getByText("Total Assets")).toBeInTheDocument();
    expect(screen.getByText("Total Liabilities")).toBeInTheDocument();
  });

  it("calculates net worth correctly", () => {
    render(<DashboardSummary accounts={[checkingAccount, creditAccount]} />);
    // Assets: 5000, Liabilities: 500 → Net Worth: 4500
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
  });

  it("sums assets from depository accounts", () => {
    render(<DashboardSummary accounts={[checkingAccount, savingsAccount]} />);
    // 5000 + 10000 = 15000
    expect(screen.getByText(/15,000/)).toBeInTheDocument();
  });

  it("treats loan balance as liability", () => {
    render(<DashboardSummary accounts={[loanAccount]} />);
    expect(screen.getByText(/8,000/)).toBeInTheDocument();
  });

  it("shows credit utilization when not masked", () => {
    render(<DashboardSummary accounts={[creditAccount]} />);
    // 500 / 2000 = 25.0%
    expect(screen.getByText(/25.0%/)).toBeInTheDocument();
    expect(screen.getByText("Credit Utilization")).toBeInTheDocument();
  });

  it("hides credit utilization card when masked", () => {
    render(<DashboardSummary accounts={[creditAccount]} isMasked />);
    expect(screen.queryByText("Credit Utilization")).not.toBeInTheDocument();
  });

  it("masks balances with bullet characters", () => {
    render(<DashboardSummary accounts={[checkingAccount]} isMasked />);
    const masked = screen.getAllByText("••••••");
    expect(masked.length).toBeGreaterThan(0);
  });

  it("shows negative net worth in red", () => {
    const bigLoan = makeAccount({
      id: "big",
      type: "loan",
      balance: { current: -50000 },
    });
    render(<DashboardSummary accounts={[bigLoan]} />);
    const netWorthValue = screen.getByText(/50,000/);
    expect(netWorthValue).toHaveClass("text-red-600");
  });

  it("shows positive net worth in green", () => {
    render(<DashboardSummary accounts={[checkingAccount]} />);
    const netWorthValue = screen.getByText(/5,000/);
    expect(netWorthValue).toHaveClass("text-green-600");
  });
});
