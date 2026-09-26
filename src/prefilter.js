// Turns raw RSS entries into clean "post" objects and drops the obvious non-matches
// for free, before anything is sent to the (paid) AI.
const cfg = $('Config').first().json;
const lower = (list) => (list || []).map((s) => String(s).toLowerCase());
const jobBoards = lower(cfg.jobBoards);
const automationCommunities = lower(cfg.automationCommunities);
// Keywords match at the start of a word: "api" matches "API"/"APIs" but not "capital".
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topicRe = new RegExp('(?:^|[^a-z0-9])(?:' + lower(cfg.topicKeywords).map(escapeRe).join('|') + ')', 'i');
const maxAgeMs = (cfg.maxAgeHours || 48) * 3600 * 1000;

const FOR_HIRE = /\[\s*for\s*hire\s*\]|\bfor\s*hire\b|\[\s*offer\s*\]|available for (hire|freelance|work|projects?)|open to (freelance|work|new|remote|projects?|opportunit)|\bhire me\b|\bmy services\b/i;
// Words that mean "someone wants to pay for work". In discussion subs (r/n8n...) only the
// title is checked, because bodies often mention money or "budget" in other contexts.
const HIRING = /\[\s*(hiring|task|paid)\s*\]|\bhiring\b|(looking for|need(ed)?|seeking|searching for)\b[^.!?\n]{0,40}?\b(freelancers?|developers?|devs?|experts?|specialists?|consultants?|someone|builders?|engineers?|automators?)\b|\bwill pay\b|\bpaid (task|gig|project|work|job)\b|\bbudget\b/i;
const MONEY = /\$\s?\d+|\d+\s?(usd|eur|€|gbp|£)\b/i;

const stripHtml = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const out = [];
for (const item of $input.all()) {
  const e = item.json || {};
  if (!e.title || !e.link) continue; // failed feed / empty entry

  const link = String(e.link);
  const sub = (link.match(/reddit\.com\/r\/([^/]+)/i) || [])[1];
  const host = (link.match(/^https?:\/\/([^/]+)/i) || [])[1] || '';
  const sourceKey = (sub || host).toLowerCase();
  const source = sub ? `Reddit r/${sub}` : host.replace(/^www\./, '');

  const title = String(e.title).trim();
  let text = e.contentSnippet ? String(e.contentSnippet) : stripHtml(e.content || e.description);
  text = text
    .replace(/submitted by\s+\/u\/[\s\S]*$/i, '') // Reddit footer
    .replace(/\d+ posts? - \d+ participants?[\s\S]*$/i, '') // Discourse footer
    .trim();

  const dateStr = e.isoDate || e.pubDate;
  const date = dateStr ? new Date(dateStr) : null;
  if (date && !isNaN(date) && Date.now() - date.getTime() > maxAgeMs) continue;

  const head = `${title}\n${text.slice(0, 600)}`;
  const isJobBoard = jobBoards.includes(sourceKey);
  const isAutomationCommunity = automationCommunities.includes(sourceKey);

  if (FOR_HIRE.test(title)) continue; // people offering services, not clients

  let hiring;
  if (isJobBoard && !sub) hiring = true; // forum job boards: every topic is a job
  else if (isJobBoard) hiring = HIRING.test(head) || MONEY.test(head);
  else hiring = HIRING.test(title);
  const onTopic = isAutomationCommunity || topicRe.test(head);
  if (!hiring || !onTopic) continue;

  out.push({
    json: {
      id: String(e.id || e.guid || link),
      source,
      title,
      text: text.slice(0, 3000),
      link,
      author: String(e.author || e.creator || '').replace(/^\/u\//, ''),
      postedAt: date && !isNaN(date) ? date.toISOString() : null,
    },
  });
}
return out;
