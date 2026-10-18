import { expect, it, vi } from "vitest";
import { createMaxxerAccountStateLoader } from "./account-state-loader";
import { emptyPokeStatistics } from "./shared/poke-statistics";
const base = { stats: { postsMatched: 5 }, matched: { synthetic: { caught: true } }, avatars: { synthetic: true }, player: { totalLikesGiven: 12 } };
const tick = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
it("loads existing collection and XP without waiting for an optional counters request; failure is unavailable, never zero", async () => {
  let reject!: (error: Error) => void;
  const applyBase = vi.fn(), applyPokes = vi.fn();
  const loader = createMaxxerAccountStateLoader({ currentScope: () => "alice", readBase: async () => base,
    readPokes: () => new Promise((_resolve, deny) => reject = deny), applyBase, applyPokes });
  await loader.load("alice"); expect(applyBase).toHaveBeenCalledExactlyOnceWith(base); expect(applyPokes).not.toHaveBeenCalled();
  reject(new Error("storage/host unavailable")); await tick();
  expect(applyPokes).toHaveBeenCalledExactlyOnceWith(null); expect(base.player.totalLikesGiven).toBe(12);
});
it("retry only reloads optional counters and a later result cannot replace a fresh retry", async () => {
  const applyBase = vi.fn(), applyPokes = vi.fn(); let finish!: (value: ReturnType<typeof emptyPokeStatistics>) => void;
  const readPokes = vi.fn().mockImplementationOnce(() => new Promise(resolve => finish = resolve)).mockResolvedValue({ ...emptyPokeStatistics(), totalSuccessfulPokes: 3 });
  const loader = createMaxxerAccountStateLoader({ currentScope: () => "alice", readBase: async () => base, readPokes, applyBase, applyPokes });
  await loader.load("alice"); await loader.retry("alice"); finish(emptyPokeStatistics()); await tick();
  expect(applyBase).toHaveBeenCalledOnce(); expect(applyPokes).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ totalSuccessfulPokes: 3 }));
});
it.each(["value", "error"])("does not apply an old scope's delayed optional %s after account switch", async kind => {
  let scope = "alice", resolve!: (value: ReturnType<typeof emptyPokeStatistics>) => void, reject!: (error: Error) => void;
  const applyBase = vi.fn(), applyPokes = vi.fn();
  const loader = createMaxxerAccountStateLoader({ currentScope: () => scope, readBase: async account => ({ ...base, account }), readPokes: account => account === "alice" ? new Promise((yes, no) => { resolve = yes; reject = no; }) : Promise.resolve({ ...emptyPokeStatistics(), totalSuccessfulPokes: 8 }), applyBase, applyPokes });
  await loader.load("alice"); scope = "bob"; await loader.load("bob"); await tick();
  if (kind === "value") resolve({ ...emptyPokeStatistics(), totalSuccessfulPokes: 99 }); else reject(new Error("old account read failed"));
  await tick(); expect(applyPokes).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ totalSuccessfulPokes: 8 }));
});

it("keeps unknown account counters unavailable without sending a host read", async () => {
  const readPokes = vi.fn(), applyPokes = vi.fn(), applyBase = vi.fn();
  const loader = createMaxxerAccountStateLoader({ currentScope: () => null, readBase: async () => base, readPokes, applyBase, applyPokes });
  await loader.load(null); await tick();
  expect(applyBase).toHaveBeenCalledExactlyOnceWith(base); expect(readPokes).not.toHaveBeenCalled(); expect(applyPokes).toHaveBeenCalledExactlyOnceWith(null);
});
