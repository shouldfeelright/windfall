export type GamePhase = 'input' | 'playing';

export type OutcomeType = 'win' | 'lose' | 'break-even';

export type BetPercent = 5 | 10 | 25 | 50 | 100;

export type SpinOutcome = {
  type: OutcomeType;
  reelDigits: [number, number, number];
  multiplier: number;
  followerDelta: number;
  newTotal: number;
};

export type RoundRecord = {
  round: number;
  outcome: OutcomeType;
  betPct: BetPercent;
  delta: number;
  total: number;
};

export type ApiErrorCode =
  | 'HANDLE_NOT_FOUND'
  | 'PRIVATE_ACCOUNT'
  | 'RATE_LIMITED'
  | 'CIRCUIT_BREAKER'
  | 'UPSTREAM_ERROR';

export type FollowerBucket = '0-1K' | '1K-10K' | '10K-100K' | '100K+';

export type ApiSuccessResponse = {
  followers: number;
  cached: boolean;
};

export type ApiErrorResponse = {
  error: ApiErrorCode;
};

export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
