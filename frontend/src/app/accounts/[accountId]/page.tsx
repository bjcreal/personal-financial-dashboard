"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { AccountDetails } from "@/components/AccountDetails";
import Link from "next/link";
import { apiGet } from "@/lib/api";

export default function AccountPage() {
  const params = useParams();
  const accountId = params?.accountId as string;
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    apiGet(`/api/accounts/${accountId}/details`)
      .then((data) => setAccount(data))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-[400px] bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Dashboard
        </Link>
        <p className="text-gray-500">Account not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
        ← Back to Dashboard
      </Link>
      <AccountDetails account={account} />
    </div>
  );
}
