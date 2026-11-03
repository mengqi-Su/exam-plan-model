// 考点钥匙算法回归：npm run test:topickey
// 1) Exam Plan 侧固定测试向量必须逐条命中期望值；
// 2) 同目录下若存在 StarQuiz 仓库，则加载 web/topicKey.js，在同一沙箱里逐向量互校，
//    保证两端「规范化 → 路径 → SHA-256 前 128 bit」输出完全一致（方案 §10.1）。
// 不触网、不需要任何 API Key。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  computeTopicKey,
  composeLinkId,
  normalizeTopicSegment,
  sha256Hex,
  topicCanonicalPath,
  TOPIC_KEY_ALGORITHM,
  TopicKeyError,
} from '../src/lib/topicKey.ts';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

interface Vector {
  id: string;
  level: string;
  subject: string;
  unit: string;
  topic: string;
  expect: string;
}

// 两端共享的测试向量，顺序与内容必须与 StarQuiz web/topicKey.js 中的 TOPIC_KEY_VECTORS 一致。
const vectors: Vector[] = [
  { id: 'basic-zh', level: 'unit', subject: '中国近代史', unit: '辛亥革命', topic: '辛亥革命', expect: 't1_f21e660d4d215529212a5bb41ebe5062' },
  { id: 'long-zh', level: 'subtopic', subject: '思想政治必修四文化生活', unit: '文化多样性与文化传播：文化的内涵与特点', topic: '世界文化具有多样性，民族文化的特殊性普遍性', expect: 't1_7acccceaae18b5f54bdb8091f11cec78' },
  { id: 'whitespace', level: 'subtopic', subject: '  计算  机  网 络 ', unit: ' TCP/IP  协议 ', topic: ' 三次\t握手 ', expect: 't1_5cd5ee5aab32139e1809da6f71a265b6' },
  { id: 'fullwidth', level: 'subtopic', subject: 'ＨＴＴＰ协议', unit: '状态码（全角）', topic: '４０４ Not Found', expect: 't1_543fbe9868e22b328200bb26cd0af08e' },
  { id: 'english-case', level: 'unit', subject: 'Computer Networks', unit: 'Transport Layer', topic: 'Transport Layer', expect: 't1_88f4c15aa2d3dfa8ac5978db26f470e3' },
  { id: 'parens', level: 'subtopic', subject: '生物（选修1）', unit: '细胞结构(线粒体)', topic: '有丝分裂（中期）', expect: 't1_8b4f92e1b518f763029c33f0740c750f' },
  { id: 'special-chars', level: 'subtopic', subject: 'C&C++ / Java', unit: '算法 #1: 递归?', topic: 'emoji 🚀 与 &/#', expect: 't1_55100f40adb43a7d5308169aafb121ea' },
  { id: 'same-topic-different-unit-a', level: 'subtopic', subject: '数学', unit: '函数', topic: '极限', expect: 't1_89a1d65483ef83987c5fc26a0a7f20fa' },
  { id: 'same-topic-different-unit-b', level: 'subtopic', subject: '数学', unit: '数列', topic: '极限', expect: 't1_5c279df07a6804ebdd128d80bf17bc1c' },
  { id: 'unit-level-target', level: 'unit', subject: '物理', unit: '力学', topic: '力学', expect: 't1_c10735bdc81268987a10cc521078be4e' },
  { id: 'subtopic-level-same-text', level: 'subtopic', subject: '物理', unit: '力学', topic: '力学', expect: 't1_5fdbecf796abfd53392aa90b4ee391d4' },
  { id: 'unit-level-topic-empty', level: 'unit', subject: '物理', unit: '力学', topic: '', expect: 't1_c10735bdc81268987a10cc521078be4e' },
  { id: 'unit-level-topic-noise', level: 'unit', subject: '物理', unit: '力学', topic: '  完全无关的展示名 ', expect: 't1_c10735bdc81268987a10cc521078be4e' },
  { id: 'empty-segments', level: 'subtopic', subject: '', unit: '   ', topic: '总论', expect: 't1_0892bdc71996249ee3789b6e9745d278' },
  { id: 'all-empty', level: 'unit', subject: '', unit: '', topic: '', expect: 't1_ecac5d9b5a55bda8b52035e2115d8e98' },
  { id: 'whitespace-variants-equal', level: 'subtopic', subject: '　历史　', unit: '  明清时期 ', topic: '闭关锁国　\t', expect: 't1_279be9cdcfd600406fbe545c7a3489ba' },
  { id: 'internal-space-matters', level: 'subtopic', subject: '历史', unit: '明清时期', topic: '闭关 锁国', expect: 't1_b9ea00017a9a971eb8ad95d0a76ad91f' },
];

console.log('topicKey 算法回归');

await check('算法版本前缀固定为 exam-plan-topic-v1', () => {
  assert.equal(TOPIC_KEY_ALGORITHM, 'exam-plan-topic-v1');
});

for (const vector of vectors) {
  await check(`向量 ${vector.id} → ${vector.expect}`, async () => {
    const key = await computeTopicKey(vector);
    assert.equal(key, vector.expect, `${vector.id} 实际 ${key} / 规范化路径 ${topicCanonicalPath(vector)}`);
    assert.match(key, /^t1_[0-9a-f]{32}$/);
  });
}

await check('分段规范化：NFKC + 折叠空白 + 去首尾 + 小写，且不截断', () => {
  assert.equal(normalizeTopicSegment('  Ａ Ｂ  '), 'a b');
  assert.equal(normalizeTopicSegment(null), '');
  assert.equal(normalizeTopicSegment(undefined), '');
  assert.equal(normalizeTopicSegment(123), '123');
  const long = '世界文化具有多样性，民族文化的特殊性普遍性'; // 21 字，超过学科显示名的 20 字截断阈值
  assert.ok(long.length > 20);
  assert.equal(normalizeTopicSegment(long).length, long.length); // 保留完整长度，绝不截断
  assert.ok(normalizeTopicSegment(long).endsWith('特殊性普遍性'));
  assert.equal(normalizeTopicSegment(long).includes('，'), false); // NFKC 把全角逗号归一为半角
});

await check('单元级目标忽略子考点展示名，子考点级保留', async () => {
  const unitA = await computeTopicKey({ level: 'unit', subject: '物理', unit: '力学', topic: '' });
  const unitB = await computeTopicKey({ level: 'unit', subject: '物理', unit: '力学', topic: '随便什么展示名' });
  const sub = await computeTopicKey({ level: 'subtopic', subject: '物理', unit: '力学', topic: '力学' });
  assert.equal(unitA, unitB);
  assert.notEqual(unitA, sub);
});

await check('不同单元下的同名考点不会撞钥匙', async () => {
  const a = await computeTopicKey({ level: 'subtopic', subject: '数学', unit: '函数', topic: '极限' });
  const b = await computeTopicKey({ level: 'subtopic', subject: '数学', unit: '数列', topic: '极限' });
  assert.notEqual(a, b);
});

await check('未知层级抛 TopicKeyError', () => {
  assert.throws(() => topicCanonicalPath({ level: 'chapter', subject: 'x', unit: 'y', topic: 'z' }), TopicKeyError);
  assert.throws(() => topicCanonicalPath({ level: '', subject: 'x', unit: 'y', topic: 'z' }), TopicKeyError);
});

await check('linkId = planId:topicKey，并忽略 planId 首尾空白', async () => {
  const key = await computeTopicKey(vectors[0]);
  assert.equal(composeLinkId(' plan-1 ', key), `plan-1:${key}`);
  assert.throws(() => composeLinkId('', key), TopicKeyError);
  assert.throws(() => composeLinkId('plan-1', ''), TopicKeyError);
});

await check('URL 编解码往返不改变钥匙', async () => {
  const raw = vectors[6]; // 含 & # ? / emoji
  const direct = await computeTopicKey(raw);
  const params = new URLSearchParams();
  params.set('subject', raw.subject);
  params.set('unit', raw.unit);
  params.set('topic', raw.topic);
  const back = Object.fromEntries(new URLSearchParams(params.toString()));
  const roundTrip = await computeTopicKey({ level: raw.level, subject: back.subject, unit: back.unit, topic: back.topic });
  assert.equal(roundTrip, direct);
  assert.equal(encodeURIComponent(raw.topic).includes('%23'), true);
});

await check('SHA-256 与 node:crypto 结果一致', async () => {
  const { createHash } = await import('node:crypto');
  const text = topicCanonicalPath(vectors[0]);
  assert.equal(await sha256Hex(text), createHash('sha256').update(text).digest('hex'));
});

// —— 跨仓库互校：加载 StarQuiz 前端实现，逐向量比对规范化路径与钥匙 ——
const here = path.dirname(fileURLToPath(import.meta.url));
const starquizFile = path.resolve(here, '../../starquiz/web/topicKey.js');
if (fs.existsSync(starquizFile)) {
  const sandbox: Record<string, unknown> = {
    crypto: globalThis.crypto,
    TextEncoder: globalThis.TextEncoder,
    URLSearchParams: globalThis.URLSearchParams,
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(starquizFile, 'utf8'), sandbox, { filename: 'starquiz/web/topicKey.js' });
  const other = sandbox.StarQuizTopicKey as {
    TOPIC_KEY_ALGORITHM: string;
    TOPIC_KEY_VECTORS: Vector[];
    normalizeSegment: (v: unknown) => string;
    canonicalPath: (v: unknown) => string;
    topicKey: (v: unknown) => Promise<string>;
    composeLinkId: (a: unknown, b: unknown) => string;
  };

  await check('StarQuiz 端向量表与本地完全一致（防单方面漂移）', () => {
    assert.equal(other.TOPIC_KEY_ALGORITHM, TOPIC_KEY_ALGORITHM);
    // 沙箱数组是另一个 realm 的 Array，deepStrictEqual 会比原型；用序列化比较值。
    const stringify = (list: Vector[]) => JSON.stringify(list.map((v) => [v.id, v.level, v.subject, v.unit, v.topic, v.expect]));
    assert.equal(stringify(other.TOPIC_KEY_VECTORS), stringify(vectors));
  });

  await check('StarQuiz 端逐向量输出与 Exam Plan 端一致', async () => {
    for (const vector of vectors) {
      assert.equal(other.canonicalPath(vector), topicCanonicalPath(vector), `${vector.id} 规范化路径不一致`);
      assert.equal(await other.topicKey(vector), await computeTopicKey(vector), `${vector.id} 钥匙不一致`);
    }
    assert.equal(other.normalizeSegment('　历史　'), normalizeTopicSegment('　历史　'));
    assert.equal(other.composeLinkId('plan-1', 't1_x'), composeLinkId('plan-1', 't1_x'));
  });
} else {
  console.log(`  skip 跨仓库互校（未找到 ${starquizFile}）`);
}

console.log(`\n${passed} topicKey checks passed`);
