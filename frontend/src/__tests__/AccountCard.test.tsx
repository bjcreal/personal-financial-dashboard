import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountCard } from "@/components/AccountCard";
import type { Account } from "@/types/account";
import * as api from "@/lib/api";

// Next.js Link needs a router context in tests
jest.mock("next/link", () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("@/lib/api", () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
}));

const mockApiPost = api.apiPost as jest.Mock;

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acct-1",
    name: "Checking",
    type: "depository",
    subtype: "checking",
    mask: "1234",
    hidden: false,
    institution: "First Bank",
    balance: { current: 2500, available: 2400 },
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe("AccountCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders account name and balance", () => {
    render(<AccountCard account={makeAccount()} />);
    expect(screen.getByText("Checking")).toBeInTheDocument();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
  });

  it("shows nickname when set", () => {
    render(<AccountCard account={makeAccount({ nickname: "My Spending" })} />);
    expect(screen.getByText("My Spending")).toBeInTheDocument();
  });

  it("masks balance when isMasked=true", () => {
    render(<AccountCard account={makeAccount()} isMasked />);
    expect(screen.getAllByText("••••••").length).toBeGreaterThan(0);
    expect(screen.queryByText("$2,500.00")).not.toBeInTheDocument();
  });

  it("shows available balance", () => {
    render(<AccountCard account={makeAccount()} />);
    expect(screen.getByText("$2,400.00")).toBeInTheDocument();
  });

  it("shows credit utilization bar for credit accounts", () => {
    const creditAcct = makeAccount({
      id: "cc-1",
      type: "credit",
      subtype: "credit card",
      balance: { current: -700, limit: 1000 },
    });
    render(<AccountCard account={creditAcct} />);
    expect(screen.getByText("Credit Used")).toBeInTheDocument();
    expect(screen.getByText("70.0%")).toBeInTheDocument();
  });

  it("calls toggle-visibility API and updates icon", async () => {
    mockApiPost.mockResolvedValue({ hidden: true });
    render(<AccountCard account={makeAccount({ hidden: false })} />);

    const visibilityBtn = screen.getByTitle("Hide account");
    fireEvent.click(visibilityBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/api/accounts/acct-1/toggle-visibility"
      );
    });
  });

  it("opens nickname edit mode on pencil click", () => {
    render(<AccountCard account={makeAccount()} />);
    const editBtn = screen.getByTitle("Edit nickname");
    fireEvent.click(editBtn);
    expect(screen.getByPlaceholderText("Checking")).toBeInTheDocument();
  });

  it("saves nickname and exits edit mode", async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const onBalanceUpdate = jest.fn();
    render(
      <AccountCard account={makeAccount()} onBalanceUpdate={onBalanceUpdate} />
    );

    fireEvent.click(screen.getByTitle("Edit nickname"));
    const input = screen.getByPlaceholderText("Checking");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.click(screen.getByTitle("Save nickname"));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/api/accounts/acct-1/update-nickname",
        { nickname: "New Name" }
      );
      expect(onBalanceUpdate).toHaveBeenCalled();
    });
  });

  it("cancels nickname edit without saving", () => {
    render(<AccountCard account={makeAccount()} />);
    fireEvent.click(screen.getByTitle("Edit nickname"));
    fireEvent.click(screen.getByTitle("Cancel"));
    expect(screen.queryByPlaceholderText("Checking")).not.toBeInTheDocument();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("shows balance update dialog for manual accounts", () => {
    const manual = makeAccount({ institution: "Manual Account" });
    render(<AccountCard account={manual} />);
    fireEvent.click(screen.getByTitle("Refresh balance"));
    expect(screen.getByText("Update Balance")).toBeInTheDocument();
  });

  it("calls refresh API for non-manual accounts", async () => {
    mockApiPost.mockResolvedValue({ change: 50 });
    render(<AccountCard account={makeAccount()} />);
    fireEvent.click(screen.getByTitle("Refresh balance"));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/accounts/acct-1/refresh");
    });
  });
});
