import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManualAccountForm } from "@/components/ManualAccountForm";
import * as api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
}));

const mockApiPost = api.apiPost as jest.Mock;

describe("ManualAccountForm", () => {
  const onSuccess = jest.fn();
  const onCancel = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders all required form fields", () => {
    render(<ManualAccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/balance/i)).toBeInTheDocument();
  });

  it("submits form with correct payload", async () => {
    mockApiPost.mockResolvedValue({ success: true });
    render(<ManualAccountForm onSuccess={onSuccess} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText(/account name/i), {
      target: { value: "Home Equity" },
    });
    fireEvent.change(screen.getByLabelText(/balance/i), {
      target: { value: "450000" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add account/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        "/api/accounts/manual",
        expect.objectContaining({
          name: "Home Equity",
          balance: 450000,
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(<ManualAccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("requires account name", async () => {
    render(<ManualAccountForm onSuccess={onSuccess} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /add account/i }));
    // HTML5 validation prevents submit — onSuccess should NOT be called
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("shows error message on API failure", async () => {
    mockApiPost.mockRejectedValue(new Error("API error 500: Internal Server Error"));
    render(<ManualAccountForm onSuccess={onSuccess} onCancel={onCancel} />);

    fireEvent.change(screen.getByLabelText(/account name/i), {
      target: { value: "Bad Account" },
    });
    fireEvent.change(screen.getByLabelText(/balance/i), {
      target: { value: "100" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add account/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
