export interface AccountBalance {
  date: string;
  current: number;
  available?: number | null;
  limit?: number | null;
}

export interface Account {
  id: string;
  name: string;
  nickname?: string | null;
  type: string;
  subtype: string | null;
  mask?: string | null;
  hidden?: boolean;
  institution?: string;
  institutionLogo?: string | null;
  balance: {
    current: number;
    available?: number | null;
    limit?: number | null;
  };
  balances?: AccountBalance[];
  plaidItem?: {
    institutionId: string;
  };
  url?: string | null;
  lastUpdated?: string | null;
}
