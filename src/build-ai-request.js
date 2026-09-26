// Builds one DeepSeek chat request per post.
const cfg = $('Config').first().json;

const system = `You screen freelance job posts for one freelancer and answer in json only.

The freelancer's profile:
${cfg.myProfile}

For the post you receive, return exactly this json shape:
{
  "is_hiring": true,
  "is_automation": true,
  "fit_score": 8,
  "budget": "$150 fixed",
  "effort": "a few hours",
  "difficulty": "easy",
  "summary": "one sentence: what the client wants built",
  "why": "one short sentence: why it does or does not fit the profile",
  "red_flags": ""
}

Rules:
- is_hiring: true only if the author wants to PAY someone for work. False if they offer their own services, ask a free question, or share a project.
- is_automation: true if the work is mainly automation, AI workflows, integrations, bots, scraping or scripting.
- budget: copy it from the post if stated (keep the currency), otherwise "unknown".
- effort: one of "a few hours", "1-3 days", "about a week", "ongoing / part-time", "full-time job", "unknown".
- difficulty: "easy", "medium" or "hard" for someone with the profile above.
- fit_score (0-10): 9-10 = small, clear, paid automation task that matches the profile; 7-8 = good match with minor gaps;
  4-6 = partial match (too big, vague, or skills missing); 0-3 = not hiring, not automation, unpaid, equity-only, or full-time job.
- red_flags: short note on scam signs (asks for upfront payment, personal data, off-platform crypto, "test task" that is real work), else "".
- Write "summary", "why" and "red_flags" in ${cfg.summaryLanguage}. Keep other values in English.`;

return $input.all().map((item) => {
  const p = item.json;
  const user = `Source: ${p.source}\nPosted: ${p.postedAt || 'unknown'}\nTitle: ${p.title}\n\n${p.text || '(no body text, judge from the title)'}`;
  return {
    json: {
      post: p,
      requestBody: {
        model: cfg.model || 'deepseek-flash',
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
    },
  };
});
