import crypto from 'node:crypto';

// Initial Mock Account Configuration (SIMULATION ONLY)
const INITIAL_ACCOUNT = {
  accountId: 'ACC-MOCK-8842',
  accountHolder: 'Alex Morgan (Demo User)',
  routingNumber: 'MOCK-09100001',
  balance: 3000.0,
  currency: 'USD',
  status: 'ACTIVE',
  isSimulation: true,
  simulationNotice: 'BankSim Environment: In-memory simulation only. No real funds, credentials, or banking connections.'
};

const INITIAL_TRANSACTIONS = [
  {
    id: 'TXN-MOCK-001',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    type: 'DEPOSIT',
    amount: 5200.0,
    recipientId: 'SELF',
    recipientName: 'Payroll Direct Deposit (Mock Corp)',
    memo: 'Monthly Bi-weekly Payroll',
    status: 'COMPLETED'
  },
  {
    id: 'TXN-MOCK-002',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    type: 'TRANSFER',
    amount: 200.0,
    recipientId: 'ACC-3310',
    recipientName: 'Utility Electric Co (Mock)',
    memo: 'Electric bill payment',
    status: 'COMPLETED'
  }
];

class MockBank {
  constructor() {
    this.reset();
    // Background garbage collection to prevent memory leaks from abandoned tokens
    this.cleanupTimer = setInterval(() => this.pruneExpiredTokens(), 60000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Periodically removes expired or already-consumed confirmation tokens from memory
   */
  pruneExpiredTokens() {
    const now = Date.now();
    for (const [token, item] of this.pendingConfirmations.entries()) {
      if (item.consumed || now > item.expiresAt) {
        this.pendingConfirmations.delete(token);
      }
    }
  }

  /**
   * Resets mock account, ledger, and confirmation tokens to baseline
   */
  reset() {
    this.account = { ...INITIAL_ACCOUNT };
    this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
    // Tokens for 2-step transfer confirmation
    // Map of token -> { token, amount, recipientId, memo, createdAt, expiresAt, consumed }
    this.pendingConfirmations = new Map();
  }

  getAccount() {
    return {
      ...this.account,
      balanceFormatted: `$${this.account.balance.toFixed(2)}`
    };
  }

  getTransactions() {
    return [...this.transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Generates a cryptographically random, short-lived confirmation token
   * for an approved transfer. Valid for 5 minutes.
   */
  createConfirmationToken({ amount, recipientId, memo }) {
    const numAmount = Number.parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Invalid transfer amount for token generation.');
    }

    if (!recipientId || typeof recipientId !== 'string') {
      throw new Error('Invalid recipient identifier.');
    }

    const token = `CONF-${crypto.randomBytes(16).toString('hex')}`;
    const payload = {
      token,
      amount: Number(numAmount.toFixed(2)),
      recipientId: recipientId.trim(),
      memo: (memo || '').trim(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute validity
      consumed: false
    };

    this.pendingConfirmations.set(token, payload);
    return payload;
  }

  getPendingConfirmation(token) {
    if (!token || !this.pendingConfirmations.has(token)) {
      return null;
    }
    const item = this.pendingConfirmations.get(token);
    if (item.consumed || Date.now() > item.expiresAt) {
      return null;
    }
    return item;
  }

  /**
   * Timing-safe verification of confirmation token strings to eliminate timing attacks
   * @param {string} candidate
   * @param {string} actual
   * @returns {boolean}
   */
  isTokenMatch(candidate, actual) {
    if (typeof candidate !== 'string' || typeof actual !== 'string') return false;
    const bufCandidate = Buffer.from(candidate);
    const bufActual = Buffer.from(actual);
    if (bufCandidate.length !== bufActual.length) return false;
    return crypto.timingSafeEqual(bufCandidate, bufActual);
  }

  /**
   * Final step of 2-step confirmation. Validates token using timing-safe comparison,
   * re-validates balance in trusted code, updates in-memory mock balance, logs the transaction,
   * and marks token consumed.
   * 
   * @param {string} token - The single-use confirmation token issued by the firewall
   * @returns {{ success: boolean, transaction?: Object, updatedAccount?: Object, error?: string }}
   */
  confirmAndExecuteTransfer(token) {
    if (!token || typeof token !== 'string') {
      return {
        success: false,
        error: 'Confirmation token is required.'
      };
    }

    const confirmation = this.pendingConfirmations.get(token);

    if (!confirmation || !this.isTokenMatch(token, confirmation.token)) {
      return {
        success: false,
        error: 'Invalid confirmation token. Transfer was rejected.'
      };
    }

    if (confirmation.consumed) {
      return {
        success: false,
        error: 'Confirmation token has already been consumed. Replay attempt prevented.'
      };
    }

    if (Date.now() > confirmation.expiresAt) {
      this.pendingConfirmations.delete(token);
      return {
        success: false,
        error: 'Confirmation token has expired. Please re-analyze the request.'
      };
    }

    // Backend-enforced balance check (Never trust frontend state!)
    if (this.account.balance < confirmation.amount) {
      return {
        success: false,
        error: `Insufficient mock balance. Current balance is $${this.account.balance.toFixed(2)}, required $${confirmation.amount.toFixed(2)}.`
      };
    }

    // Mark token consumed immediately before balance mutation
    confirmation.consumed = true;
    this.pendingConfirmations.set(token, confirmation);

    // Deduct mock balance
    this.account.balance = Number((this.account.balance - confirmation.amount).toFixed(2));

    // Record transaction
    const newTxn = {
      id: `TXN-MOCK-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      type: 'TRANSFER',
      amount: confirmation.amount,
      recipientId: confirmation.recipientId,
      recipientName: `Recipient ${confirmation.recipientId}`,
      memo: confirmation.memo || 'BankSim Transfer',
      status: 'COMPLETED',
      confirmationTokenUsed: token.slice(0, 10) + '...'
    };

    this.transactions.push(newTxn);

    return {
      success: true,
      transaction: newTxn,
      updatedAccount: this.getAccount()
    };
  }
}

export const mockBank = new MockBank();
