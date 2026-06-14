"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { FinancialGroupChart } from "@/components/FinancialGroupChart";
import { DashboardSummary } from "@/components/DashboardSummary";
import { AccountCard } from "@/components/AccountCard";
import { ManualAccountForm } from "@/components/ManualAccountForm";
import {
  EyeIcon,
  EyeSlashIcon,
  LockOpenIcon,
  LockClosedIcon,
  PlusIcon,
  ArrowPathIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { NetWorthChart } from "@/components/NetWorthChart";
import { Account } from "@/types/account";

export default function Home() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingInstitutions, setIsRefreshingInstitutions] =
    useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [isMasked, setIsMasked] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [isConnectingCoinbase, setIsConnectingCoinbase] = useState(false);
  const [refreshingInstitutions, setRefreshingInstitutions] = useState<
    Record<string, boolean>
  >({});
  const [disconnectingInstitutions, setDisconnectingInstitutions] = useState<
    Record<string, boolean>
  >({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsWithHistory, setAccountsWithHistory] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [institutionShowHidden, setInstitutionShowHidden] = useState<
    Record<string, boolean>
  >({});

  const { data: accountsData, refetch } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => apiGet<Account[]>("/api/accounts"),
  });

  // Group accounts by institution
  const accountsByInstitution =
    accountsData?.reduce((acc, account) => {
      if (account.institution && !acc[account.institution]) {
        acc[account.institution] = [];
      }
      if (account.institution) {
        acc[account.institution].push(account);
      }
      return acc;
    }, {} as Record<string, Account[]>) || {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const visibleAccounts =
    accountsData?.filter((account) => !account.hidden || showHidden) || [];
  const hiddenAccounts =
    accountsData?.filter((account) => account.hidden) || [];

  const refreshInstitutions = async () => {
    try {
      setIsRefreshingInstitutions(true);
      await apiPost("/api/plaid/refresh-institutions");
      await refetch();
    } catch (error) {
      console.error("Error refreshing institutions:", error);
    } finally {
      setIsRefreshingInstitutions(false);
    }
  };

  const refreshBalances = async () => {
    try {
      setIsRefreshing(true);
      await apiPost("/api/accounts/refresh");
      await refetch();
    } catch (error) {
      console.error("Error refreshing balances:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const onSuccess = useCallback(
    async (public_token: string) => {
      try {
        await apiPost("/api/plaid/exchange-token", { public_token });
        refetch();
      } catch (error) {
        console.error("Error linking account:", error);
      }
    },
    [refetch]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const connectCoinbase = async () => {
    try {
      setIsConnectingCoinbase(true);
      const { authUrl } = await apiGet<{ authUrl: string }>("/api/crypto/oauth");
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error connecting to Coinbase:", error);
    } finally {
      setIsConnectingCoinbase(false);
    }
  };

  const refreshInstitution = async (institutionId: string) => {
    try {
      setRefreshingInstitutions((prev) => ({ ...prev, [institutionId]: true }));
      await apiPost("/api/accounts/refresh", { institution_id: institutionId });
      await refetch();
    } catch (error) {
      console.error("Error refreshing institution:", error);
    } finally {
      setRefreshingInstitutions((prev) => ({
        ...prev,
        [institutionId]: false,
      }));
    }
  };

  const disconnectInstitution = async (institutionId: string) => {
    if (
      !confirm(
        "Are you sure you want to disconnect this institution? This will remove all associated accounts."
      )
    ) {
      return;
    }

    try {
      setDisconnectingInstitutions((prev) => ({
        ...prev,
        [institutionId]: true,
      }));
      await apiPost("/api/accounts/disconnect", { institution_id: institutionId });
      await refetch();
    } catch (error) {
      console.error("Error disconnecting institution:", error);
    } finally {
      setDisconnectingInstitutions((prev) => ({
        ...prev,
        [institutionId]: false,
      }));
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await apiGet<Account[]>("/api/accounts");
      setAccounts(data);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchAccountsWithHistory = async () => {
    try {
      const data = await apiGet<Account[]>("/api/accounts/history");
      setAccountsWithHistory(data);
    } catch (error) {
      console.error("Error fetching account history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleInstitutionHidden = (institution: string) => {
    setInstitutionShowHidden((prev) => ({
      ...prev,
      [institution]: !prev[institution],
    }));
  };

  useEffect(() => {
    const getToken = async () => {
      try {
        const { link_token } = await apiPost<{ link_token: string }>("/api/plaid/create-link-token");
        setLinkToken(link_token);
      } catch (error) {
        console.error("Error getting link token:", error);
      }
    };

    if (!linkToken) getToken();
  }, [linkToken]);

  useEffect(() => {
    fetchAccounts();
    fetchAccountsWithHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoadingAccounts || isLoadingHistory) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-[400px] bg-gray-100 rounded"></div>
              ))}
            </div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={refreshBalances}
              disabled={isRefreshing}
              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Refresh all balances"
            >
              <svg
                className={`w-6 h-6 ${isRefreshing ? "animate-spin" : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={refreshInstitutions}
              disabled={isRefreshingInstitutions}
              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
              title="Refresh institutions"
            >
              <svg
                className={`w-6 h-6 ${
                  isRefreshingInstitutions ? "animate-spin" : ""
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </button>
            <button
              onClick={() => setIsMasked(!isMasked)}
              className="text-gray-600 hover:text-gray-800"
              title={
                isMasked
                  ? "Show sensitive information"
                  : "Hide sensitive information"
              }
            >
              {isMasked ? (
                <LockClosedIcon className="w-6 h-6" />
              ) : (
                <LockOpenIcon className="w-6 h-6" />
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowManualForm(true)}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add Manual Account
              </button>
              <button
                onClick={connectCoinbase}
                disabled={isConnectingCoinbase}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {isConnectingCoinbase ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    Connecting...
                  </div>
                ) : (
                  "Connect Coinbase"
                )}
              </button>
              <button
                onClick={() => open()}
                disabled={!ready}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Connect Bank
              </button>
            </div>
          </div>
        </div>

        {/* Manual Account Form Dialog */}
        {showManualForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">Add Manual Account</h2>
              <ManualAccountForm
                onSuccess={() => {
                  setShowManualForm(false);
                  refetch();
                }}
                onCancel={() => setShowManualForm(false)}
              />
            </div>
          </div>
        )}

        {accountsData?.length ? (
          <>
            <DashboardSummary accounts={accountsData} isMasked={isMasked} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <NetWorthChart
                accounts={accountsWithHistory}
                isMasked={isMasked}
              />
              <FinancialGroupChart accounts={accounts} isMasked={isMasked} />
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Accounts</h2>
              <button
                onClick={() => setShowHidden(!showHidden)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                {showHidden ? (
                  <>
                    <EyeSlashIcon className="w-5 h-5" />
                    <span>Hide hidden accounts</span>
                  </>
                ) : (
                  <>
                    <EyeIcon className="w-5 h-5" />
                    <span>Show hidden accounts</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-8">
              {Object.entries(accountsByInstitution).map(
                ([institution, institutionAccounts]) => {
                  const institutionId =
                    institutionAccounts[0]?.plaidItem?.institutionId;
                  const isRefreshing = institutionId
                    ? refreshingInstitutions[institutionId]
                    : false;
                  const institutionLogo =
                    institutionAccounts[0]?.institutionLogo;
                  const showHiddenForInstitution =
                    institutionShowHidden[institution] || false;

                  // Split accounts into visible and hidden
                  const visibleAccounts = institutionAccounts.filter(
                    (account) => !account.hidden
                  );
                  const hiddenAccounts = institutionAccounts.filter(
                    (account) => account.hidden
                  );
                  const hasHiddenAccounts = hiddenAccounts.length > 0;

                  return (
                    <div
                      key={institution}
                      className="bg-white p-6 rounded-lg shadow-md"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          {institutionLogo && (
                            <img
                              src={institutionLogo}
                              alt={institution}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          <h2 className="text-lg font-semibold">
                            {institution}
                          </h2>
                          <div className="flex flex-col ml-2">
                            {(() => {
                              const assets = institutionAccounts
                                .filter(
                                  (account) =>
                                    (!account.hidden ||
                                      showHiddenForInstitution) &&
                                    !["credit", "loan"].includes(
                                      account.type.toLowerCase()
                                    )
                                )
                                .reduce(
                                  (sum, account) =>
                                    sum + account.balance.current,
                                  0
                                );

                              const liabilities = institutionAccounts
                                .filter(
                                  (account) =>
                                    (!account.hidden ||
                                      showHiddenForInstitution) &&
                                    ["credit", "loan"].includes(
                                      account.type.toLowerCase()
                                    )
                                )
                                .reduce(
                                  (sum, account) =>
                                    sum + Math.abs(account.balance.current),
                                  0
                                );

                              return isMasked ? (
                                <span className="text-lg text-gray-600">
                                  ••••••
                                </span>
                              ) : (
                                <>
                                  {assets > 0 && (
                                    <span className="text-lg text-green-600">
                                      +$
                                      {assets.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  )}
                                  {liabilities > 0 && (
                                    <span className="text-lg text-red-600">
                                      -$
                                      {liabilities.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasHiddenAccounts && (
                            <button
                              onClick={() =>
                                toggleInstitutionHidden(institution)
                              }
                              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                              title={
                                showHiddenForInstitution
                                  ? "Hide hidden accounts"
                                  : "Show hidden accounts"
                              }
                            >
                              {showHiddenForInstitution ? (
                                <EyeSlashIcon className="w-4 h-4" />
                              ) : (
                                <EyeIcon className="w-4 h-4" />
                              )}
                              <span className="hidden sm:inline">
                                {showHiddenForInstitution ? "Hide" : "Show"}{" "}
                                Hidden ({hiddenAccounts.length})
                              </span>
                            </button>
                          )}
                          {institutionId && (
                            <>
                              <button
                                onClick={() =>
                                  refreshInstitution(institutionId)
                                }
                                disabled={isRefreshing}
                                className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                                title="Refresh institution"
                              >
                                <ArrowPathIcon
                                  className={`w-5 h-5 ${
                                    isRefreshing ? "animate-spin" : ""
                                  }`}
                                />
                              </button>
                              <button
                                onClick={() =>
                                  disconnectInstitution(institutionId)
                                }
                                disabled={
                                  disconnectingInstitutions[institutionId]
                                }
                                className="text-gray-600 hover:text-red-600 disabled:opacity-50"
                                title="Disconnect institution"
                              >
                                <XCircleIcon className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {institutionAccounts
                          .sort((a, b) => {
                            // Sort by type: checking > savings > investment > credit > loan
                            const typeOrder = {
                              depository: 1,
                              investment: 2,
                              credit: 3,
                              loan: 4,
                            };
                            const typeComparison =
                              (typeOrder[
                                a.type.toLowerCase() as keyof typeof typeOrder
                              ] || 99) -
                              (typeOrder[
                                b.type.toLowerCase() as keyof typeof typeOrder
                              ] || 99);

                            // If same type, sort by balance (largest to smallest)
                            if (typeComparison === 0) {
                              const aBalance = ["credit", "loan"].includes(
                                a.type.toLowerCase()
                              )
                                ? -Math.abs(a.balance.current)
                                : a.balance.current;
                              const bBalance = ["credit", "loan"].includes(
                                b.type.toLowerCase()
                              )
                                ? -Math.abs(b.balance.current)
                                : b.balance.current;
                              return bBalance - aBalance;
                            }

                            return typeComparison;
                          })
                          .filter(
                            (account) =>
                              !account.hidden || showHiddenForInstitution
                          )
                          .map((account) => (
                            <AccountCard
                              key={account.id}
                              account={account}
                              onBalanceUpdate={refetch}
                              isMasked={isMasked}
                            />
                          ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {hiddenAccounts.length > 0 && showHidden && (
              <>
                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                  Hidden Accounts
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hiddenAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onBalanceUpdate={refetch}
                      isMasked={isMasked}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
