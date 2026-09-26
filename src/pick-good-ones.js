// Reads the AI verdicts, keeps the good gigs and formats a Telegram message for each.
const cfg = $('Config').first().json;
const memory = $getWorkflowStaticData('global');
memory.seen = memory.seen || {};
const minScore = Number(cfg.minScore ?? 7);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const parseVerdict = (content) => {
  if (!content) return null;
  try { return JSON.parse(content); } catch (e) {}
  const m = String(content).match(/\{[\s\S]*\}/); // tolerate text around the json
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
};

const good = [];
let failed = 0;
$input.all().forEach((item, i) => {
  const post = $('Build AI request').itemMatching(i).json.post;
  const verdict = parseVerdict(item.json?.choices?.[0]?.message?.content);

  if (!verdict) {
    // AI call failed (no credit, timeout, empty answer...). Forget the post so the
    // next run tries it again instead of losing it.
    failed++;
    delete memory.seen[post.link];
    return;
  }

  const score = Number(verdict.fit_score) || 0;
  if (!verdict.is_hiring || !verdict.is_automation || score < minScore) return;

  const lines = [
    `🎯 <b>${score}/10</b> · ${esc(post.source)}`,
    `<b>${esc(post.title)}</b>`,
    '',
    `💬 ${esc(verdict.summary)}`,
    `💰 ${esc(verdict.budget || 'unknown')} · ⏱ ${esc(verdict.effort || 'unknown')} · 🧩 ${esc(verdict.difficulty || '?')}`,
    `👍 ${esc(verdict.why)}`,
  ];
  if (verdict.red_flags) lines.push(`⚠️ ${esc(verdict.red_flags)}`);
  lines.push('', `🔗 ${esc(post.link)}`);

  good.push({
    json: {
      chatId: cfg.telegramChatId,
      score,
      title: post.title,
      link: post.link,
      message: lines.join('\n').slice(0, 4000), // Telegram limit is 4096
    },
  });
});

if (failed) console.log(`${failed} AI call(s) failed – those posts will be retried next run.`);
return good.sort((a, b) => b.json.score - a.json.score);
