/**
 * Centralized API client.
 *
 * All requests are sent to the API Gateway URL (NEXT_PUBLIC_API_URL) with the
 * Cognito ID token attached as Bearer authorization.
 *
 * Usage:
 *   import { apiGet, apiPost } from "@/lib/api";
 *   const accounts = await apiGet("/api/accounts");
 */
import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getIdToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  } catch {
    return undefined;
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export const apiGet = <T = unknown>(path: string) =>
  request<T>(path, { method: "GET" });

export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T = unknown>(path: string) =>
  request<T>(path, { method: "DELETE" });
