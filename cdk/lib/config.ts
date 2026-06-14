export type PlaidEnv = 'sandbox' | 'development' | 'production';

export interface StageConfig {
  readonly name: string;
  readonly plaidEnv: PlaidEnv;
}

export const STAGES: Record<string, StageConfig> = {
  dev:     { name: 'dev',     plaidEnv: 'sandbox' },
  staging: { name: 'staging', plaidEnv: 'sandbox' },
  prod:    { name: 'prod',    plaidEnv: 'production' },
};

export function resolveStage(stageName: string): StageConfig {
  const stage = STAGES[stageName];
  if (!stage) {
    throw new Error(
      `Unknown stage "${stageName}". Must be one of: ${Object.keys(STAGES).join(', ')}`
    );
  }
  return stage;
}
