// 考试倒计时口径回归：npm run test:countdown
// 同一个考试在四个地方露面：科目页属性行（带时钟）、今日页气泡、总览卡组 D-N、编辑科目时的日期预告。
// 以前四处各算各的——首页按自然日说「还剩 43 天」，科目页按时分秒说「42 天 21:47:55」，
// 用户只能理解成其中一个是坏的。现在四个说法都从 lib/date 一处出，这份测试守的就是那条不变式：
// 只要还剩一整天以上，各处报的天数必须是同一个数。
import assert from 'node:assert/strict';
import {
  countdownDays,
  countdownDaysLabel,
  countdownDnLabel,
  countdownClockLabel,
  examCountdown,
} from '../src/lib/date.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm, 0, 0);
const labelNumber = (label) => Number(label.replace(/\D+/g, ' ').trim().split(/\s+/)[0]);

check('还剩 42 天 6 小时：四处说的是同一个 42', () => {
  const now = at(2026, 11, 8, 3, 0);
  const c = examCountdown('2026-12-20', '09:00', now);
  assert.equal(c.days, 42);
  assert.equal(c.hours, 6);
  assert.equal(c.calendarDays, 42);
  assert.equal(countdownDaysLabel(c, true), '还剩 42 天');
  assert.equal(countdownDnLabel(c, true), 'D-42');
  assert.equal(countdownClockLabel(c, true), '42 天 06:00:00');
});

check('不足一天但考试在明天：不写「0 天」，天数退回自然日', () => {
  const c = examCountdown('2026-11-09', '09:00', at(2026, 11, 8, 9, 30));
  assert.equal(c.days, 0);
  assert.equal(c.calendarDays, 1);
  assert.equal(countdownClockLabel(c, true), '23:30:00');
  assert.equal(countdownDaysLabel(c, true), '还剩 1 天');
  assert.equal(countdownDnLabel(c, true), 'D-1');
});

check('今天开考还没考完：说「今天考试」，时钟照常走', () => {
  const c = examCountdown('2026-11-08', '09:00', at(2026, 11, 8, 8, 0));
  assert.equal(c.passed, false);
  assert.equal(countdownDaysLabel(c, true), '今天考试');
  assert.equal(countdownDnLabel(c, true), '今天考试');
  assert.equal(countdownClockLabel(c, true), '01:00:00');
});

check('考试时刻已过：今天说「今天考试」，不会说成过了 0 天', () => {
  const c = examCountdown('2026-11-08', '09:00', at(2026, 11, 8, 10, 0));
  assert.equal(c.passed, true);
  assert.equal(countdownDaysLabel(c, true), '已结束');
  assert.equal(countdownClockLabel(c, true), '已到期');
  // 编辑弹窗那句预告走自然日，同一天过点仍归「今天」
  assert.equal(c.calendarDays, 0);
});

check('昨天考完：过了 1 天，不是过了 0.6 天', () => {
  const c = examCountdown('2026-11-07', '09:00', at(2026, 11, 8, 10, 0));
  assert.equal(c.passed, true);
  assert.equal(c.calendarDays, -1);
  assert.equal(Math.abs(c.calendarDays), 1);
});

check('跨年只剩 1 小时 30 分：自然日 1 天，时钟 01:30:00', () => {
  const c = examCountdown('2027-01-01', '00:30', at(2026, 12, 31, 23, 0));
  assert.equal(c.days, 0);
  assert.equal(c.calendarDays, 1);
  assert.equal(countdownClockLabel(c, true), '01:30:00');
  assert.equal(countdownDaysLabel(c, true), '还剩 1 天');
});

check('没填时间按 09:00，脏时间字符串夹紧而不是炸', () => {
  const now = at(2026, 11, 8, 3, 0);
  assert.deepEqual(examCountdown('2026-11-10', '', now), examCountdown('2026-11-10', '09:00', now));
  assert.deepEqual(examCountdown('2026-11-10', 'abc', now), examCountdown('2026-11-10', '09:00', now));
  assert.deepEqual(examCountdown('2026-11-10', '99:99', now), examCountdown('2026-11-10', '23:59', now));
});

check('没有考试日期或日期不合法：返回 null，页面自己决定显示「未设定」', () => {
  assert.equal(examCountdown('', '09:00', at(2026, 11, 8)), null);
  assert.equal(examCountdown(null, null, at(2026, 11, 8)), null);
  assert.equal(examCountdown('2026-13-99', '09:00', at(2026, 11, 8)), null);
  assert.equal(examCountdown('随手写的', '09:00', at(2026, 11, 8)), null);
});

check('不变式：剩余超过一天的任意时刻，天数文案与那条时钟里的天数一致', () => {
  for (let offset = 1; offset <= 90; offset++) {
    for (const hour of [0, 7, 9, 13, 23]) {
      for (const examHour of [0, 8, 9, 15, 22]) {
        const now = at(2026, 11, 8, hour, 17);
        const exam = new Date(2026, 10, 8 + offset, examHour, 0, 0, 0);
        const label = examDateStr(exam);
        const c = examCountdown(label, `${String(examHour).padStart(2, '0')}:00`, now);
        if (c.days < 1) continue; // 不足一天交给自然日那条规则，另一组用例已覆盖
        const fromDaysLabel = labelNumber(countdownDaysLabel(c, true));
        const fromDn = labelNumber(countdownDnLabel(c, true));
        const fromClock = labelNumber(countdownClockLabel(c, true));
        assert.equal(fromDaysLabel, fromClock, `days label vs clock @${label} ${now}`);
        assert.equal(fromDn, fromClock, `D-N vs clock @${label} ${now}`);
      }
    }
  }
});

function examDateStr(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

check('英文文案两边都有，不会出现只剩中文的气泡', () => {
  const now = at(2026, 11, 8, 3, 0);
  assert.equal(countdownDaysLabel(examCountdown('2026-12-20', '09:00', now), false), '42 days left');
  assert.equal(countdownClockLabel(examCountdown('2026-12-20', '09:00', now), false), '42d 06:00:00');
  assert.equal(countdownDnLabel(examCountdown('2026-12-20', '09:00', now), false), 'D-42');
  assert.equal(countdownDaysLabel(examCountdown('2026-11-08', '09:00', at(2026, 11, 8, 8)), false), 'Exam today');
  assert.equal(countdownClockLabel(examCountdown('2026-11-07', '09:00', at(2026, 11, 8, 8)), false), 'Passed');
});

console.log(`\ncountdown 口径回归：${passed} 项通过`);
