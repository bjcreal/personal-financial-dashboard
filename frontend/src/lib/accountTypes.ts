import {
  BanknotesIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  HomeIcon,
  ChartBarIcon,
  WalletIcon,
  QuestionMarkCircleIcon,
  CurrencyDollarIcon,
  TruckIcon,
  AcademicCapIcon,
  CircleStackIcon,
} from "@heroicons/react/24/solid";

export const ACCOUNT_TYPES = {
  depository: {
    value: "depository",
    label: "Cash & Savings",
    color: "rgba(16, 185, 129, 0.7)", // Green
    borderColor: "rgb(16, 185, 129)",
    order: 1,
    group: "Assets",
    subtypes: [
      { value: "checking", label: "Checking", icon: WalletIcon },
      { value: "savings", label: "Savings", icon: BanknotesIcon },
      { value: "cd", label: "CD", icon: BuildingLibraryIcon },
      {
        value: "money market",
        label: "Money Market",
        icon: BuildingLibraryIcon,
      },
      { value: "paypal", label: "PayPal", icon: WalletIcon },
      {
        value: "cash management",
        label: "Cash Management",
        icon: BanknotesIcon,
      },
      { value: "ebt", label: "EBT", icon: WalletIcon },
      { value: "prepaid", label: "Prepaid", icon: WalletIcon },
    ],
    defaultIcon: BuildingLibraryIcon,
  },
  investment: {
    value: "investment",
    label: "Investments",
    color: "rgba(139, 92, 246, 0.7)", // Purple
    borderColor: "rgb(139, 92, 246)",
    order: 2,
    group: "Investments",
    subtypes: [
      { value: "401k", label: "401(k)", icon: ChartBarIcon },
      { value: "401a", label: "401(a)", icon: ChartBarIcon },
      { value: "403b", label: "403(b)", icon: ChartBarIcon },
      { value: "457b", label: "457(b)", icon: ChartBarIcon },
      { value: "529", label: "529", icon: ChartBarIcon },
      { value: "ira", label: "IRA", icon: ChartBarIcon },
      { value: "roth", label: "Roth IRA", icon: ChartBarIcon },
      { value: "roth 401k", label: "Roth 401(k)", icon: ChartBarIcon },
      { value: "brokerage", label: "Brokerage", icon: ChartBarIcon },
      { value: "mutual fund", label: "Mutual Fund", icon: ChartBarIcon },
      { value: "simple ira", label: "SIMPLE IRA", icon: ChartBarIcon },
      { value: "sep ira", label: "SEP IRA", icon: ChartBarIcon },
      { value: "pension", label: "Pension", icon: ChartBarIcon },
      { value: "trust", label: "Trust", icon: ChartBarIcon },
      {
        value: "crypto",
        label: "Crypto Exchange",
        icon: CircleStackIcon,
      },
      {
        value: "non-taxable brokerage account",
        label: "Non-Taxable Brokerage",
        icon: ChartBarIcon,
      },
      { value: "hsa", label: "HSA", icon: ChartBarIcon },
      {
        value: "non-custodial wallet",
        label: "Non-Custodial Wallet",
        icon: ChartBarIcon,
      },
      { value: "sarsep", label: "SARSEP", icon: ChartBarIcon },
      { value: "other", label: "Other", icon: ChartBarIcon },
    ],
    defaultIcon: ChartBarIcon,
  },
  credit: {
    value: "credit",
    label: "Credit Cards",
    color: "rgba(239, 68, 68, 0.7)", // Red
    borderColor: "rgb(239, 68, 68)",
    order: 3,
    group: "Liabilities",
    subtypes: [
      { value: "credit card", label: "Credit Card", icon: CreditCardIcon },
      {
        value: "line of credit",
        label: "Line of Credit",
        icon: CreditCardIcon,
      },
    ],
    defaultIcon: CreditCardIcon,
  },
  loan: {
    value: "loan",
    label: "Loans",
    color: "rgba(245, 158, 11, 0.7)", // Orange
    borderColor: "rgb(245, 158, 11)",
    order: 4,
    group: "Liabilities",
    subtypes: [
      { value: "mortgage", label: "Mortgage", icon: HomeIcon },
      { value: "student", label: "Student Loan", icon: AcademicCapIcon },
      { value: "auto", label: "Auto Loan", icon: TruckIcon },
      { value: "personal", label: "Personal Loan", icon: CurrencyDollarIcon },
      { value: "business", label: "Business Loan", icon: CurrencyDollarIcon },
      { value: "home equity", label: "Home Equity", icon: HomeIcon },
      { value: "construction", label: "Construction", icon: HomeIcon },
      { value: "consumer", label: "Consumer", icon: CurrencyDollarIcon },
    ],
    defaultIcon: CurrencyDollarIcon,
  },
  asset: {
    value: "asset",
    label: "Assets",
    color: "rgba(168, 85, 247, 0.7)", // Purple
    borderColor: "rgb(168, 85, 247)",
    order: 5,
    group: "Assets",
    subtypes: [
      { value: "real_estate", label: "Real Estate", icon: HomeIcon },
      { value: "vehicle", label: "Vehicle", icon: TruckIcon },
      { value: "art", label: "Art", icon: CurrencyDollarIcon },
      { value: "other", label: "Other", icon: CurrencyDollarIcon },
    ],
    defaultIcon: CurrencyDollarIcon,
  },
  other: {
    value: "other",
    label: "Other",
    color: "rgba(107, 114, 128, 0.7)", // Gray
    borderColor: "rgb(107, 114, 128)",
    order: 6,
    group: "Assets",
    subtypes: [
      { value: "other", label: "Other", icon: QuestionMarkCircleIcon },
    ],
    defaultIcon: QuestionMarkCircleIcon,
  },
} as const;

export type AccountType = keyof typeof ACCOUNT_TYPES;
export type AccountSubtype =
  (typeof ACCOUNT_TYPES)[AccountType]["subtypes"][number]["value"];

export const FINANCIAL_GROUPS = {
  Assets: {
    color: "rgba(16, 185, 129, 0.7)", // Green
    types: ["depository", "asset", "other"],
  },
  Investments: {
    color: "rgba(139, 92, 246, 0.7)", // Purple
    types: ["investment", "brokerage"],
  },
  Liabilities: {
    color: "rgba(239, 68, 68, 0.7)", // Red
    types: ["credit", "loan"],
  },
} as const;

export type FinancialGroup = keyof typeof FINANCIAL_GROUPS;

// Helper functions
export function getAccountTypeInfo(type: string, subtype: string | null) {
  const normalizedType = type.toLowerCase() as AccountType;
  const accountType = ACCOUNT_TYPES[normalizedType] || ACCOUNT_TYPES.other;

  if (!subtype) {
    return {
      label: accountType.label,
      icon: accountType.defaultIcon,
      color: accountType.color,
      borderColor: accountType.borderColor,
      group: accountType.group,
    };
  }

  const subtypeInfo = accountType.subtypes.find(
    (st) => st.value === subtype.toLowerCase()
  );
  return {
    label: subtypeInfo?.label || accountType.label,
    icon: subtypeInfo?.icon || accountType.defaultIcon,
    color: accountType.color,
    borderColor: accountType.borderColor,
    group: accountType.group,
  };
}

export function getAccountTypeOrder(type: string): number {
  const normalizedType = type.toLowerCase() as AccountType;
  return ACCOUNT_TYPES[normalizedType]?.order || 99;
}

export function isLiability(type: string): boolean {
  const normalizedType = type.toLowerCase() as AccountType;
  return ACCOUNT_TYPES[normalizedType]?.group === "Liabilities";
}

export function getFinancialGroup(type: string): FinancialGroup {
  const normalizedType = type.toLowerCase() as AccountType;
  return ACCOUNT_TYPES[normalizedType]?.group || "Assets";
}
