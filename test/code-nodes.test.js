// Runs the Code-node scripts outside n8n with a tiny emulation of the n8n Code-node
// runtime ($input, $('Node'), itemMatching, $getWorkflowStaticData) and fixture data.
// Usage: node test/code-nodes.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SRC = path.join(__dirname, '..', 'src');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const staticData = { global: {} };
const outputs = {}; // node name -> items

function runCode(nodeName, file, inputItems) {
  const code = fs.readFileSync(path.join(SRC, file), 'utf8');
  const $input = { all: () => inputItems, first: () => inputItems[0] };
  const $ = (name) => {
    const items = outputs[name];
    if (!items) throw new Error(`Node "${name}" has not run`);
    return {
      first: () => items[0],
      all: () => items,
      // Index alignment matches n8n's pairing here (1 output item per input item).
      itemMatching: (i) => items[i],
    };
  };
  const $getWorkflowStaticData = (type) => staticData[type];
  const fn = new AsyncFunction('$input', '$', '$getWorkflowStaticData', 'console', code);
  return fn($input, $, $getWorkflowStaticData, console).then((res) => {
    assert(Array.isArray(res), `${nodeName} must return an array`);
    res.forEach((it) => assert(it && typeof it.json === 'object', `${nodeName} items need .json`));
    outputs[nodeName] = res;
    return res;
  });
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

// Shapes follow what n8n's RSS Read node (rss-parser) outputs for Reddit Atom and Discourse RSS.
const reddit = (sub, id, title, body, h = 2) => ({
  json: {
    title,
    link: `https://www.reddit.com/r/${sub}/comments/${id}/slug/`,
    pubDate: hoursAgo(h),
    isoDate: hoursAgo(h),
    author: '/u/someone',
    content: `<!-- SC_OFF --><div class="md"><p>${body}</p></div><!-- SC_ON --> &#32; submitted by &#32; <a href="https://www.reddit.com/user/someone"> /u/someone </a>`,
    contentSnippet: `${body}\n    submitted by    /u/someone    to    r/${sub}  \n [link]   [comments]`,
    id: `t3_${id}`,
  },
});
const forum = (id, title, body, h = 3) => ({
  json: {
    title,
    link: `https://community.n8n.io/t/slug/${id}`,
    pubDate: new Date(Date.now() - h * 3600e3).toUTCString(),
    isoDate: hoursAgo(h),
    creator: 'client42',
    content: `<p>${body}</p>`,
    contentSnippet: `${body}\n1 post - 1 participant\nRead full topic`,
    guid: `community.n8n.io-topic-${id}`,
    categories: ['Jobs'],
  },
});

const FEED_ITEMS = [
  reddit('forhire', 'a1', '[Hiring] n8n expert to connect Typeform -> Google Sheets -> Slack', 'Small job, budget $150 fixed. Should take a few hours.'),
  reddit('forhire', 'a2', '[For Hire] I build n8n and Make automations', 'Portfolio in my profile.'),
  reddit('forhire', 'a3', '[Hiring] Logo designer for bakery', 'Need a new logo, $80.'),                  // off-topic
  reddit('n8n', 'a4', 'How do I loop over items in the HTTP node?', 'Beginner question, thanks!'),         // not hiring
  reddit('n8n', 'a5', 'Looking for someone to build an AI agent that answers WhatsApp messages', 'Paid, budget around 300 EUR.'),
  reddit('DoneDirtCheap', 'a6', '[TASK] Scrape 200 product pages into a CSV', 'Will pay $40 via PayPal.'),
  reddit('forhire', 'a7', '[Hiring] Zapier automation for my capital markets newsletter', 'Budget $200.'),
  reddit('forhire', 'a8', '[Hiring] Real estate agent assistant', 'Need a virtual assistant for calls, $10/hr.'), // off-topic
  reddit('forhire', 'a9', '[Hiring] Old post: Make.com scenario fix', 'Budget $50.', 72),                   // too old
  // Real-world false positives seen in the first live run (all must be dropped):
  reddit('n8n', 'b1', 'I quit my job to vibe code a LinkedIn outreach automation tool, and made $8K', 'Here is how.'),
  reddit('n8n', 'b2', 'I built an AI-powered real estate lead qualification workflow. Looking for feedback', 'Budget: 1 Cr, location...'),
  reddit('n8n', 'b3', "I'm very confused, stuck on 2 things. Need help", 'Webhook verify token...'),
  reddit('n8n', 'b4', 'AI Automation Engineer open to freelance and remote opportunities', 'My experience includes...'),
  reddit('n8n', 'b5', 'Looking for 1-2 n8n Builders for Long-Term Collaboration', 'Paid per project.'), // keep
  forum('101', 'N8N AI Automation Developer (Remote)', 'We need help building 3 workflows with OpenAI and Airtable.'),
  forum('102', 'Available for Freelance | n8n Automation + AI/API Integrations', 'Hire me.'),
  { json: { error: { message: 'getaddrinfo ENOTFOUND' } } }, // a feed that failed
];

(async () => {
  // ---- Config & feeds
  await runCode('Config', 'config.js', [{ json: {} }]);
  const feeds = await runCode('List feeds', 'list-feeds.js', outputs['Config']);
  assert.strictEqual(feeds.length, 2);
  assert(feeds[0].json.url.startsWith('https://www.reddit.com/'));

  // ---- Pre-filter
  const kept = await runCode('Clean & pre-filter', 'prefilter.js', FEED_ITEMS);
  const keptIds = kept.map((i) => i.json.link.match(/comments\/(\w+)|\/t\/slug\/(\d+)/).slice(1).find(Boolean));
  console.log('pre-filter kept:', keptIds.join(', '));
  assert.deepStrictEqual(keptIds.sort(), ['101', 'a1', 'a5', 'a6', 'a7', 'b5'].sort());
  const a1 = kept.find((i) => i.json.link.includes('/a1/')).json;
  assert.strictEqual(a1.source, 'Reddit r/forhire');
  assert(!/submitted by/i.test(a1.text), 'reddit footer must be stripped');
  assert.strictEqual(a1.author, 'someone');
  const f = kept.find((i) => i.json.link.includes('community.n8n.io')).json;
  assert.strictEqual(f.source, 'community.n8n.io');
  assert(!/participant|Read full topic/.test(f.text), 'forum footer must be stripped');

  // ---- Dedupe + cost guard (limit 3 for this test)
  outputs['Config'][0].json.maxAiChecksPerRun = 3;
  const batch1 = await runCode('Only new posts', 'only-new.js', kept);
  assert.strictEqual(batch1.length, 3);
  const batch2 = await runCode('Only new posts', 'only-new.js', kept);
  assert.strictEqual(batch2.length, 3, 'second run gets the next 3');
  const batch3 = await runCode('Only new posts', 'only-new.js', kept);
  assert.strictEqual(batch3.length, 0, 'nothing is checked twice');
  console.log('dedupe: run1=%d run2=%d run3=%d', batch1.length, batch2.length, batch3.length);

  // ---- Build AI requests
  const all5 = batch1.concat(batch2).slice(0, 5);
  const reqs = await runCode('Build AI request', 'build-ai-request.js', all5);
  assert.strictEqual(reqs.length, 5);
  const body = reqs[0].json.requestBody;
  assert.strictEqual(body.model, 'deepseek-flash');
  assert.deepStrictEqual(body.response_format, { type: 'json_object' });
  assert(/json/i.test(body.messages[0].content), 'DeepSeek JSON mode needs the word "json" in the prompt');
  assert(body.messages[0].content.includes('Simplified Chinese'));
  JSON.stringify(body); // must be serialisable for the HTTP node

  // ---- Mock DeepSeek answers (one per request, same order)
  const answer = (obj) => ({ json: { choices: [{ message: { role: 'assistant', content: typeof obj === 'string' ? obj : JSON.stringify(obj) } }] } });
  const v = (score, extra = {}) => ({
    is_hiring: true, is_automation: true, fit_score: score, budget: '$150 fixed', effort: 'a few hours',
    difficulty: 'easy', summary: '把 Typeform 表单接到 Google Sheets 和 Slack', why: '小而清晰，正好是 n8n 的强项', red_flags: '', ...extra,
  });
  const aiOut = [
    answer(v(9)),
    answer('Here you go:\n' + JSON.stringify(v(8, { red_flags: '要求先付押金 <注意>' })) + '\nThanks'), // text around json + html chars
    answer(v(5)),                                        // below minScore
    { json: { error: { message: 'Insufficient Balance', httpCode: '402' } } }, // failed call
    answer(v(10, { is_hiring: false })),                 // AI says not hiring
  ];
  const linkOfFailed = reqs[3].json.post.link;
  assert(staticData.global.seen[linkOfFailed], 'was marked seen before the AI call');

  const good = await runCode('Pick the good ones', 'pick-good-ones.js', aiOut);
  console.log('sent to Telegram:', good.map((g) => `${g.json.score} ${g.json.title}`));
  assert.strictEqual(good.length, 2);
  assert.strictEqual(good[0].json.score, 9);
  assert.strictEqual(good[0].json.chatId, 'YOUR_CHAT_ID');
  assert(good[1].json.message.includes('&lt;注意&gt;'), 'HTML must be escaped for Telegram parse_mode=HTML');
  assert(!staticData.global.seen[linkOfFailed], 'failed AI call must be retried next run');
  assert(good.every((g) => g.json.message.length <= 4096));

  console.log('\n--- sample Telegram message ---\n' + good[0].json.message + '\n');
  console.log('ALL TESTS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
