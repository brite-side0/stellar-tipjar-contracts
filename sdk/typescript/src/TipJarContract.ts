import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Keypair,
} from '@stellar/stellar-sdk';

import { SendTipParams, TipResult, WithdrawResult } from './types';
import { getRpcUrl, retry, parseEvents } from './utils';
import { TransactionError } from './errors';

export class TipJarContract {
  private contract: Contract;
  private server: SorobanRpc.Server;
  private networkPassphrase: string;

  constructor(contractId: string, network: 'testnet' | 'mainnet') {
    this.contract = new Contract(contractId);
    this.server = new SorobanRpc.Server(getRpcUrl(network));

    this.networkPassphrase =
      network === 'testnet'
        ? Networks.TESTNET
        : Networks.PUBLIC;
  }

  /**
   * Send Tip
   */
  async sendTip(
    params: SendTipParams,
    secretKey: string
  ): Promise<TipResult> {
    return retry(async () => {
      const account = await this.server.getAccount(params.tipper);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          this.contract.call(
            'send_tip',
            params.creator,
            params.amount,
            params.tipper,
            params.memo || ''
          )
        )
        .setTimeout(30)
        .build();

      const keypair = Keypair.fromSecret(secretKey);
      tx.sign(keypair);

      const result = await this.server.sendTransaction(tx);

      if (result.status !== 'PENDING') {
        throw new TransactionError('Transaction failed');
      }

      return {
        success: true,
        txHash: result.hash,
      };
    });
  }

  /**
   * Get Balance (read-only)
   */
  async getBalance(creator: string): Promise<bigint> {
    const result = await this.server.simulateTransaction(
      this.contract.call('get_balance', creator)
    );

    return BigInt(result.result?.retval?._value || 0);
  }

  /**
   * Withdraw
   */
  async withdraw(
    creator: string,
    amount: bigint,
    secretKey: string
  ): Promise<WithdrawResult> {
    return retry(async () => {
      const account = await this.server.getAccount(creator);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(this.contract.call('withdraw', creator, amount))
        .setTimeout(30)
        .build();

      const keypair = Keypair.fromSecret(secretKey);
      tx.sign(keypair);

      const result = await this.server.sendTransaction(tx);

      if (result.status !== 'PENDING') {
        throw new TransactionError('Withdraw failed');
      }

      return {
        success: true,
        txHash: result.hash,
      };
    });
  }

  /**
   * Event Parser
   */
  parseEvents(events: any[]) {
    return parseEvents(events);
  }
}