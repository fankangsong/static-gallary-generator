/**
 * 零依赖的有界并发工具（H4）
 *
 * 为什么不用 p-limit：其较新版本为 ESM-only，且本项目只用到最基础的能力，
 * 引入新依赖不划算（pnpm store / 离线环境的额外风险）。
 */

/**
 * 以固定并发度执行异步任务，返回数组顺序与入参 items 一致。
 *
 * @template T, R
 * @param {T[]} items 输入项
 * @param {number} limit 最大并发数；非法值（<1、非数字）回落为 1（串行）
 * @param {(item: T, index: number) => Promise<R>} worker 任务函数
 * @returns {Promise<R[]>} 与 items 等长且同序的结果数组
 */
async function mapWithConcurrency(items, limit, worker) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);

  const concurrency =
    Number.isFinite(limit) && Number.isInteger(limit) && limit >= 1
      ? limit
      : 1;

  if (list.length === 0) return results;

  let cursor = 0;
  const runners = new Array(Math.min(concurrency, list.length));

  const runOne = async () => {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      results[index] = await worker(list[index], index);
    }
  };

  for (let i = 0; i < runners.length; i++) {
    runners[i] = runOne();
  }

  await Promise.all(runners);
  return results;
}

module.exports = { mapWithConcurrency };
