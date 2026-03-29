import { SorobanRpc } from '@stellar/stellar-sdk';

export const getRpcUrl = (network: 'testnet' | 'mainnet') => {
  return network === 'testnet'
    ? 'https://soroban-testnet.stellar.org'
    : 'https://soroban.stellar.org';
};

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    return retry(fn, retries - 1);
  }
}

export function parseEvents(events: any[]): any[] {
  return events.map((e) => ({
    type: e.type,
    data: e.value,
  }));
}