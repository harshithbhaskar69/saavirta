import { DurableObject } from "cloudflare:workers";

// Each object coordinates one shared quota. No IP addresses or coordinates persist.
export class ProviderBudget extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS budget (slot INTEGER PRIMARY KEY, bucket INTEGER NOT NULL, used INTEGER NOT NULL)",
    );
  }

  reserve(kind: "weather" | "api", cost = 1): boolean {
    if (!Number.isSafeInteger(cost) || cost < 1 || cost > 100) return false;
    const now = Date.now(),
      date = new Date(now);
    const buckets = [
      Math.floor(now / 60000),
      Math.floor(now / 3600000),
      Math.floor(now / 86400000),
      date.getUTCFullYear() * 12 + date.getUTCMonth(),
    ];
    const limits =
      kind === "weather" ? [120, 1000, 6000, 100000] : [240, 6000, 40000, 600000];
    return this.ctx.storage.transactionSync(() => {
      const rows = this.ctx.storage.sql
        .exec<{ slot: number; bucket: number; used: number }>(
          "SELECT slot,bucket,used FROM budget",
        )
        .toArray();
      const used = buckets.map(
        (bucket, slot) =>
          rows.find((r) => r.slot === slot && r.bucket === bucket)?.used ?? 0,
      );
      if (used.some((value, i) => value + cost > limits[i])) return false;
      buckets.forEach((bucket, slot) =>
        this.ctx.storage.sql.exec(
          "INSERT INTO budget(slot,bucket,used) VALUES(?,?,?) ON CONFLICT(slot) DO UPDATE SET bucket=excluded.bucket,used=excluded.used",
          slot,
          bucket,
          used[slot] + cost,
        ),
      );
      return true;
    });
  }
}
