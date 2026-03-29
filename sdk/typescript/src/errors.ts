export class TipJarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TipJarError';
  }
}

export class NetworkError extends TipJarError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TransactionError extends TipJarError {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionError';
  }
}