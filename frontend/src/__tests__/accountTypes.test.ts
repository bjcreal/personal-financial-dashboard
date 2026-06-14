import {
  getAccountTypeInfo,
  getAccountTypeOrder,
  isLiability,
  getFinancialGroup,
  ACCOUNT_TYPES,
} from "@/lib/accountTypes";
import { WalletIcon, CreditCardIcon, ChartBarIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";

describe("getAccountTypeInfo", () => {
  it("returns correct info for depository/checking", () => {
    const info = getAccountTypeInfo("depository", "checking");
    expect(info.label).toBe("Checking");
    expect(info.icon).toBe(WalletIcon);
    expect(info.group).toBe("Assets");
  });

  it("returns default icon when subtype is unknown", () => {
    const info = getAccountTypeInfo("depository", "unknown-subtype");
    expect(info.icon).toBe(ACCOUNT_TYPES.depository.defaultIcon);
    expect(info.label).toBe("Cash & Savings");
  });

  it("returns default icon when subtype is null", () => {
    const info = getAccountTypeInfo("credit", null);
    expect(info.icon).toBe(CreditCardIcon);
  });

  it("returns correct info for investment/401k", () => {
    const info = getAccountTypeInfo("investment", "401k");
    expect(info.label).toBe("401(k)");
    expect(info.icon).toBe(ChartBarIcon);
    expect(info.group).toBe("Investments");
  });

  it("falls back to other type for unknown account type", () => {
    const info = getAccountTypeInfo("unknown-type", null);
    expect(info.icon).toBe(QuestionMarkCircleIcon);
    expect(info.group).toBe("Assets");
  });

  it("is case-insensitive for type", () => {
    const info1 = getAccountTypeInfo("CREDIT", "credit card");
    const info2 = getAccountTypeInfo("credit", "credit card");
    expect(info1.label).toBe(info2.label);
    expect(info1.group).toBe("Liabilities");
  });
});

describe("getAccountTypeOrder", () => {
  it("returns correct sort order", () => {
    expect(getAccountTypeOrder("depository")).toBe(1);
    expect(getAccountTypeOrder("investment")).toBe(2);
    expect(getAccountTypeOrder("credit")).toBe(3);
    expect(getAccountTypeOrder("loan")).toBe(4);
    expect(getAccountTypeOrder("asset")).toBe(5);
    expect(getAccountTypeOrder("other")).toBe(6);
  });

  it("returns 99 for unknown types", () => {
    expect(getAccountTypeOrder("mystery")).toBe(99);
  });
});

describe("isLiability", () => {
  it("returns true for credit accounts", () => {
    expect(isLiability("credit")).toBe(true);
  });

  it("returns true for loan accounts", () => {
    expect(isLiability("loan")).toBe(true);
  });

  it("returns false for depository accounts", () => {
    expect(isLiability("depository")).toBe(false);
  });

  it("returns false for investment accounts", () => {
    expect(isLiability("investment")).toBe(false);
  });
});

describe("getFinancialGroup", () => {
  it("groups depository as Assets", () => {
    expect(getFinancialGroup("depository")).toBe("Assets");
  });

  it("groups investment as Investments", () => {
    expect(getFinancialGroup("investment")).toBe("Investments");
  });

  it("groups credit as Liabilities", () => {
    expect(getFinancialGroup("credit")).toBe("Liabilities");
  });

  it("groups loan as Liabilities", () => {
    expect(getFinancialGroup("loan")).toBe("Liabilities");
  });

  it("defaults to Assets for unknown type", () => {
    expect(getFinancialGroup("unknown")).toBe("Assets");
  });
});
