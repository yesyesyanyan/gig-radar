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

const FOR_HIRE = /\[\s*for\s*hire\s*\]|\bfor\s*hire\b|\[\s*offer\s*\]|available for (hire|freelance|work|projects?)|\bhire me\b|\bopen to work\b|\bmy services\b/i;
const HIRING = /\[\s*(hiring|task|paid)\s*\]|\bhiring\b|\bwe'?re hiring\b|looking for (a |an |some )?(freelancer|developer|dev|expert|specialist|consultant|someone|person|help|builder|engineer)|need(ed)? (a |an |some )?(freelancer|developer|dev|expert|specialist|someone|help|builder|engineer)|\bwill pay\b|\bpaid (task|gig|project|work)\b|\bbudget\b|\$\s?\d+|\d+\s?(usd|eur|€|gbp|£)\b/i;

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
  text = text.replace(/submitted by\s+\/u\/\S+.*$/i, '').trim(); // Reddit footer

  const dateStr = e.isoDate || e.pubDate;
  const date = dateStr ? new Date(dateStr) : null;
  if (date && !isNaN(date) && Date.now() - date.getTime() > maxAgeMs) continue;

  const head = `${title}\n${text.slice(0, 600)}`;
  const isJobBoard = jobBoards.includes(sourceKey);
  const isAutomationCommunity = automationCommunities.includes(sourceKey);

  if (FOR_HIRE.test(title)) continue; // people offering services, not clients

  const hiring = HIRING.test(head) || (isJobBoard && !sub); // forum job boards: every topic is a job
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
