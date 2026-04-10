import type { FollowerBucket } from '$lib/types';

export function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return count.toString();
}

export function followerBucket(count: number): FollowerBucket {
  if (count >= 100_000) return '100K+';
  if (count >= 10_000) return '10K-100K';
  if (count >= 1_000) return '1K-10K';
  return '0-1K';
}
