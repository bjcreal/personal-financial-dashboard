/**
 * Tests for src/lib/api.ts
 * Mocks `fetchAuthSession` (aws-amplify/auth) and global `fetch`.
 */
import { apiGet, apiPost, apiDelete } from "@/lib/api";

// Mock aws-amplify/auth before the module loads
jest.mock("aws-amplify/auth", () => ({
  fetchAuthSession: jest.fn(),
}));

import { fetchAuthSession } from "aws-amplify/auth";

const mockFetchAuthSession = fetchAuthSession as jest.Mock;

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    statusText: "OK",
  }) as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
  mockFetchAuthSession.mockResolvedValue({
    tokens: { idToken: { toString: () => "test-id-token" } },
  });
});

describe("apiGet", () => {
  it("sends GET with Authorization header", async () => {
    mockFetch(200, { accounts: [] });
    const result = await apiGet("/api/accounts");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/accounts",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-id-token",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(result).toEqual({ accounts: [] });
  });

  it("omits Authorization header when not authenticated", async () => {
    mockFetchAuthSession.mockResolvedValue({ tokens: undefined });
    mockFetch(200, {});
    await apiGet("/api/accounts");

    const call = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(call.headers).not.toHaveProperty("Authorization");
  });

  it("throws on non-2xx response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
      statusText: "Not Found",
    }) as jest.Mock;

    await expect(apiGet("/api/missing")).rejects.toThrow("API error 404");
  });
});

describe("apiPost", () => {
  it("sends POST with JSON body", async () => {
    mockFetch(200, { success: true });
    await apiPost("/api/plaid/exchange-token", { public_token: "pt_123" });

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.example.com/api/plaid/exchange-token");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ public_token: "pt_123" });
  });

  it("sends POST without body when none provided", async () => {
    mockFetch(200, {});
    await apiPost("/api/plaid/refresh-institutions");

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(opts.body).toBeUndefined();
  });
});

describe("apiDelete", () => {
  it("sends DELETE request", async () => {
    mockFetch(200, { deleted: 3 });
    const result = await apiDelete("/api/accounts/acct-1/transactions");

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(opts.method).toBe("DELETE");
    expect(result).toEqual({ deleted: 3 });
  });
});
