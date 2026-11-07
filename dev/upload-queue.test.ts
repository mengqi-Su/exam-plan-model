// 一批资料的读取队列回归：npm run test:queue
// 上传这里以前是一个 for 循环顺序读：20 份资料读到第 3 份卡住，界面只剩一个转圈的图标，
// 停不下来也看不到读到哪，用户只能刷新把整批丢掉。这份测试守的就是队列本身的四条不变式：
// 并发不超过 2、看得见每份的状态、取消只影响没开始的、预算用满剩下的算「没轮到」而不是「读坏了」。
import assert from 'node:assert/strict';
import {
  UPLOAD_CONCURRENCY,
  pendingUploadCount,
  pickFailedFiles,
  runUploadQueue,
  toUploadTasks,
  uploadOutcomeNotice,
  uploadTaskKey,
} from '../src/lib/uploadQueue.ts';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

/* 假文件：内容就是正文，字数由它自己算，省得测试里再引一份解析器 */
const file = (name, text) => new File([text], name, { type: 'text/plain' });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const note = '武昌起义是 1911 年 10 月 10 日在武昌爆发的武装起义。';
const threeFiles = () => [file('a.txt', note), file('b.txt', note), file('c.txt', note)];

/** 观察并发峰值：每份开工时登记一次，看在场的最多有几个 */
function concurrencyProbe(runMs = 5) {
  let live = 0;
  let peak = 0;
  return {
    async run() {
      live += 1;
      peak = Math.max(peak, live);
      await sleep(runMs);
      live -= 1;
      return { text: note };
    },
    peak: () => peak,
  };
}

await check('并发就是设定的那份数：不多开一个坑', async () => {
  const probe = concurrencyProbe();
  const files = Array.from({ length: 8 }, (_, i) => file(`f${i}.txt`, note));
  const outcome = await runUploadQueue(files, { run: probe.run });
  assert.equal(probe.peak(), UPLOAD_CONCURRENCY, `同时在读的最多 ${UPLOAD_CONCURRENCY} 份`);
  assert.equal(outcome.done.length, 8);
  assert.equal(outcome.failed.length, 0);
});

await check('读出来的字数按可见字符累计，done 保持上传顺序', async () => {
  const seen = [];
  const outcome = await runUploadQueue(threeFiles(), {
    run: async () => ({ text: note }),
    onTasks: (tasks) => seen.push(tasks.map((t) => t.state).join(',')),
  });
  assert.equal(outcome.chars, note.replace(/\s/g, '').length * 3, '3 份 × 每份可见字数');
  assert.deepEqual(
    outcome.done.map((item) => item.name),
    ['a.txt', 'b.txt', 'c.txt'],
    '完成列表按上传顺序，不按谁先读完'
  );
  assert.ok(seen.some((line) => line.includes('working')), '过程中要看得见「正在读」');
});

await check('中间一份读坏了：只有那一份是失败，其他照常入库', async () => {
  const outcome = await runUploadQueue(threeFiles(), {
    run: async (f) => {
      if (f.name === 'b.txt') throw new Error('这个文件读不出文字');
      return { text: note };
    },
  });
  assert.equal(outcome.done.length, 2);
  assert.equal(outcome.failed.length, 1);
  assert.equal(outcome.failed[0].name, 'b.txt');
  assert.equal(outcome.failed[0].error, '这个文件读不出文字', '原因要带出来，不能只剩文件名');
});

await check('取消：在场的那份读完，排队的标成没读，不是失败', async () => {
  let started = 0;
  let cancel = false;
  const files = Array.from({ length: 6 }, (_, i) => file(`f${i}.txt`, note));
  const outcome = await runUploadQueue(files, {
    run: async () => {
      started += 1;
      await sleep(4);
      if (started >= 2) cancel = true;
      return { text: note };
    },
    isCancelled: () => cancel,
  });
  assert.equal(outcome.done.length, 2, '取消前开工的都算读完');
  assert.equal(outcome.failed.length, 0, '没轮到不等于读坏了');
  assert.equal(outcome.cancelled.length, 4);
  const tasks = toUploadTasks(files);
  assert.equal(pendingUploadCount(tasks), 6, '开跑之前 6 份都算没读');
});

await check('预算用满：剩下的是「这一批装不下」，一句里说清几份没读', async () => {
  const budgetChars = note.replace(/\s/g, '').length;
  const outcome = await runUploadQueue(threeFiles(), {
    run: async () => ({ text: note }),
    charBudget: budgetChars,
  });
  /* 预算是读出来一份才算得清的数，所以在场的两份都会读完：多出来的那一份是有意的，
     把它们半路掐了反而更糟——那份资料既没入库也没失败，成了谁也不认的孤儿。 */
  assert.equal(outcome.done.length, 2, '已开工的读完，之后不再开新的');
  assert.equal(outcome.overBudget.length, 1);
  assert.equal(outcome.budgetReached, true);
  const line = uploadOutcomeNotice(outcome, true);
  assert.ok(line.includes('剩下 1 份没有读'), line);
  assert.ok(!/失败|读不出/.test(line), '预算拦下不等于失败');
});

await check('只重跑失败那几份，且进度列表里不出现双胞胎', async () => {
  const files = threeFiles();
  const first = await runUploadQueue(files, {
    run: async (f) => {
      if (f.name === 'b.txt') throw new Error('这个文件读不出文字');
      return { text: note };
    },
  });
  const retry = pickFailedFiles(files, first.failed);
  assert.deepEqual(retry.files.map((f) => f.name), ['b.txt'], '成功的不该被再读一遍');
  const second = await runUploadQueue(retry.files, { run: async () => ({ text: note }), keepKeys: retry.keepKeys });
  assert.equal(second.done.length, 1);
  assert.equal(second.done[0].key, first.failed[0].key, '重试沿用原来那条的 key');
  assert.notEqual(second.done[0].key, uploadTaskKey(files[1]), 'key 里带序号，同名同大小也各算一份');
});

await check('英文那两句和练习端同一个说法：单数说 file，不留 file(s)', async () => {
  const one = {
    done: [{ key: 'a', name: 'a.txt', value: {}, chars: 12_000 }],
    failed: [],
    cancelled: [{ key: 'b', name: 'b.txt', sizeBytes: 1, state: 'cancelled' as const }],
    overBudget: [{ key: 'c', name: 'c.txt', sizeBytes: 1, state: 'over-budget' as const }],
    chars: 12_000,
    budgetReached: true,
  };
  assert.equal(
    uploadOutcomeNotice(one, false),
    'Read 1 file · 12,000 characters — one batch is full, 1 file not read. Split them into a second batch. Cancelled — 1 file not read.'
  );
  const many = { ...one, done: [{}, {}, {}] as never, overBudget: [{}, {}, {}, {}, {}] as never, cancelled: [{}] as never };
  assert.ok(uploadOutcomeNotice(many, false).includes('5 files not read'), uploadOutcomeNotice(many, false));
  /* 「源码里不许写 file(s)」这条全站规则由 test:copy 统一守，这里不各扫一遍。 */
});

console.log(`\n${passed} upload-queue checks passed`);