// Core Coin wallet — all balance changes go through here, always atomic + audited.
// NEVER modify coin_wallets directly from routes; always call these helpers.

import { and, desc, eq, sql } from "drizzle-orm";
import type { createDb } from "~/lib/db/index";
import { type CoinTxType, coinBundles, coinTransactions, coinWallets } from "../../db/schema";

type Db = ReturnType<typeof createDb>;

export async function getOrCreateWallet(db: Db, userId: string) {
  const existing = await db.select().from(coinWallets).where(eq(coinWallets.userId, userId)).get();
  if (existing) return existing;

  const now = new Date();
  await db
    .insert(coinWallets)
    .values({ userId, balance: 0, totalPurchased: 0, totalSpent: 0, updatedAt: now });
  return { userId, balance: 0, totalPurchased: 0, totalSpent: 0, updatedAt: now };
}

export async function getBalance(db: Db, userId: string): Promise<number> {
  const w = await db
    .select({ balance: coinWallets.balance })
    .from(coinWallets)
    .where(eq(coinWallets.userId, userId))
    .get();
  return w?.balance ?? 0;
}

export async function creditCoins(
  db: Db,
  userId: string,
  amount: number,
  type: CoinTxType,
  refType: string | null,
  refId: string | null,
  note: string | null,
): Promise<number> {
  if (amount <= 0) throw new Error("Credit amount must be positive");

  // D1 does not support interactive transactions — use atomic upsert + sequential reads
  await db
    .insert(coinWallets)
    .values({
      userId,
      balance: amount,
      totalPurchased: type === "purchase" ? amount : 0,
      totalSpent: 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: coinWallets.userId,
      set: {
        balance: sql`${coinWallets.balance} + ${amount}`,
        totalPurchased:
          type === "purchase"
            ? sql`${coinWallets.totalPurchased} + ${amount}`
            : coinWallets.totalPurchased,
        updatedAt: new Date(),
      },
    });

  const after = await db
    .select({ b: coinWallets.balance })
    .from(coinWallets)
    .where(eq(coinWallets.userId, userId))
    .get();
  const balanceAfter = after?.b ?? 0;

  await db.insert(coinTransactions).values({
    id: crypto.randomUUID(),
    userId,
    type,
    amount,
    balanceAfter,
    refType,
    refId,
    note,
    createdAt: new Date(),
  });

  return balanceAfter;
}

// Returns new balance or throws "INSUFFICIENT_BALANCE"
export async function debitCoins(
  db: Db,
  userId: string,
  amount: number,
  type: CoinTxType,
  refType: string | null,
  refId: string | null,
  note: string | null,
): Promise<number> {
  if (amount <= 0) throw new Error("Debit amount must be positive");

  // Check balance before deducting
  const wallet = await db
    .select({ balance: coinWallets.balance })
    .from(coinWallets)
    .where(eq(coinWallets.userId, userId))
    .get();
  if (!wallet || wallet.balance < amount) throw new Error("INSUFFICIENT_BALANCE");

  // Atomic deduct — WHERE balance >= amount prevents overdraft even under concurrency
  const result = await db
    .update(coinWallets)
    .set({
      balance: sql`${coinWallets.balance} - ${amount}`,
      totalSpent: sql`${coinWallets.totalSpent} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(and(eq(coinWallets.userId, userId), sql`${coinWallets.balance} >= ${amount}`))
    .returning({ balance: coinWallets.balance });

  if (!result.length) throw new Error("INSUFFICIENT_BALANCE");
  const balanceAfter = result[0].balance;

  await db.insert(coinTransactions).values({
    id: crypto.randomUUID(),
    userId,
    type,
    amount: -amount,
    balanceAfter,
    refType,
    refId,
    note,
    createdAt: new Date(),
  });

  return balanceAfter;
}

export async function getTransactionHistory(db: Db, userId: string, limit = 50) {
  return db
    .select()
    .from(coinTransactions)
    .where(eq(coinTransactions.userId, userId))
    .orderBy(desc(coinTransactions.createdAt))
    .limit(limit);
}

export async function getActiveBundles(db: Db) {
  return db
    .select()
    .from(coinBundles)
    .where(eq(coinBundles.isActive, true))
    .orderBy(coinBundles.displayOrder);
}
