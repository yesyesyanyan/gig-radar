// ============================================================
//  GIG RADAR – SETTINGS
//  Edit the values below, then save. Everything else reads from here.
// ============================================================
return [{
  json: {
    // 1) Where to look. Any RSS/Atom feed works – add or remove freely.
    feeds: [
      {
        name: 'Reddit',
        url: 'https://www.reddit.com/r/forhire+DoneDirtCheap+slavelabour+n8n+automation+nocode+zapier/new/.rss?limit=100',
      },
      {
        name: 'n8n Community',
        url: 'https://community.n8n.io/c/jobs/13.rss',
      },
    ],

    // Sources that are job boards: every post is a job/offer, so no "hiring" words are required.
    jobBoards: ['forhire', 'donedirtcheap', 'slavelabour', 'community.n8n.io'],

    // Sources that are already about automation, so the topic keywords are not required.
    automationCommunities: ['n8n', 'automation', 'nocode', 'zapier', 'community.n8n.io'],

    // 2) Words that mean "this post is about automation work".
    topicKeywords: [
      'n8n', 'make.com', 'integromat', 'zapier', 'automation', 'automate', 'workflow',
      'ai agent', 'ai assistant', 'chatbot', 'gpt', 'openai', 'llm', 'deepseek', 'claude',
      'api', 'integration', 'webhook', 'scrap', 'airtable', 'notion', 'google sheets',
      'crm', 'gohighlevel', 'telegram bot', 'whatsapp', 'python script',
    ],

    // 3) Who you are – the AI scores every gig against this.
    myProfile:
      'I build AI automations with n8n, LLM APIs (DeepSeek/OpenAI), webhooks, REST APIs, ' +
      'Google Sheets, Notion, Telegram and email. I prefer small, well-defined remote tasks ' +
      '(a few hours to a few days, roughly under $500 fixed price) that I can later turn into ' +
      'portfolio pieces. Any language is fine. Not interested in full-time jobs, unpaid work, ' +
      'or "equity only" offers.',

    // 4) AI settings
    model: 'deepseek-flash',          // cheap + fast. 'deepseek-v4-pro' for harder judgement
    summaryLanguage: 'Simplified Chinese',
    minScore: 7,                      // only gigs scoring >= this (0-10) are sent to you
    maxAiChecksPerRun: 15,            // cost guard: max posts sent to the AI per run
    maxAgeHours: 48,                  // ignore posts older than this

    // 5) Where to send the alerts (see README: "Get your Telegram chat ID")
    telegramChatId: 'YOUR_CHAT_ID',
  },
}];
