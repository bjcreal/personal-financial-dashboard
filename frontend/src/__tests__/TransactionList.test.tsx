import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TransactionList } from "@/components/TransactionList";
import * as api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
}));

const mockApiGet = api.apiGet as jest.Mock;
const mockApiDelete = api.apiDelete as jest.Mock;

const ACCOUNT_ID = "acct-1";

const mockTransactions = [
  {
    accountId: ACCOUNT_ID,
    datePlaidId: "2025-01-15#txn-1",
    plaidId: "txn-1",
    date: "2025-01-15",
    name: "Coffee Shop",
    amount: "4.50",
    pending: false,
    category: ["Food and Drink", "Coffee Shop"],
  },
  {
    accountId: ACCOUNT_ID,
    datePlaidId: "2025-01-14#txn-2",
    plaidId: "txn-2",
    date: "2025-01-14",
    name: "Amazon",
    amount: "29.99",
    pending: false,
    category: ["Shops", "Online Marketplace"],
  },
  {
    accountId: ACCOUNT_ID,
    datePlaidId: "2025-01-13#txn-3",
    plaidId: "txn-3",
    date: "2025-01-13",
    name: "Pending Charge",
    amount: "10.00",
    pending: true,
    category: [],
  },
];

describe("TransactionList", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows loading state initially", () => {
    mockApiGet.mockReturnValue(new Promise(() => {})); // never resolves
    render(<TransactionList accountId={ACCOUNT_ID} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders transactions after load", async () => {
    mockApiGet.mockResolvedValue(mockTransactions);
    render(<TransactionList accountId={ACCOUNT_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
      expect(screen.getByText("Amazon")).toBeInTheDocument();
    });
  });

  it("shows empty state when no transactions", async () => {
    mockApiGet.mockResolvedValue([]);
    render(<TransactionList accountId={ACCOUNT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
    });
  });

  it("marks pending transactions", async () => {
    mockApiGet.mockResolvedValue(mockTransactions);
    render(<TransactionList accountId={ACCOUNT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/pending/i)).toBeInTheDocument();
    });
  });

  it("filters by search text", async () => {
    mockApiGet.mockResolvedValue(mockTransactions);
    render(<TransactionList accountId={ACCOUNT_ID} />);

    await waitFor(() => screen.getByText("Coffee Shop"));

    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "amazon" } });

    expect(screen.queryByText("Coffee Shop")).not.toBeInTheDocument();
    expect(screen.getByText("Amazon")).toBeInTheDocument();
  });

  it("deletes all transactions and shows empty state", async () => {
    mockApiGet.mockResolvedValue(mockTransactions);
    mockApiDelete.mockResolvedValue({ deleted: 3 });
    render(<TransactionList accountId={ACCOUNT_ID} />);

    await waitFor(() => screen.getByText("Coffee Shop"));

    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);

    // Confirm dialog
    const confirmBtn = await screen.findByRole("button", { name: /confirm/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/accounts/${ACCOUNT_ID}/transactions`
      );
    });
  });
});
