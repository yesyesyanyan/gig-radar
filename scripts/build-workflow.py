"""Assembles workflows/gig-radar.json from the Code-node sources in src/."""
import json, uuid, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = lambda name: (ROOT / "src" / name).read_text(encoding="utf-8").strip() + "\n"
nid = lambda name: str(uuid.uuid5(uuid.NAMESPACE_URL, "gig-radar/" + name))


def node(name, type_, version, pos, params, **extra):
    n = {"parameters": params, "id": nid(name), "name": name, "type": type_,
         "typeVersion": version, "position": pos}
    n.update(extra)
    return n


def code(name, pos, file):
    return node(name, "n8n-nodes-base.code", 2, pos, {"jsCode": src(file)})


def sticky(name, pos, w, h, color, content):
    return node(name, "n8n-nodes-base.stickyNote", 1, pos,
                {"content": content, "height": h, "width": w, "color": color})


Y = 400
nodes = [
    sticky("Note: About", [-620, 20], 520, 700, 4,
           "## 📡 Gig Radar\n"
           "Finds small **paid automation gigs** (n8n, Make, Zapier, AI agents, APIs) on Reddit "
           "and the n8n forum, lets **DeepSeek** score each one against *your* profile, and sends "
           "only the good ones to **Telegram**.\n\n"
           "### Setup (5 min)\n"
           "1. Open **Config** → set `telegramChatId`, edit `myProfile`.\n"
           "2. **DeepSeek: score gig** → create a *Header Auth* credential: "
           "Name `Authorization`, Value `Bearer sk-...`.\n"
           "3. **Send to Telegram** → create a *Telegram* credential with your bot token.\n"
           "4. Click **Test workflow**, then switch the workflow to **Active**.\n\n"
           "### Cost\n"
           "Free pre-filter first; at most `maxAiChecksPerRun` posts per hour go to the AI "
           "(`deepseek-flash`, a fraction of a cent each).\n\n"
           "Repo & docs: see README on GitHub."),
    sticky("Note: Fetch", [-60, 180], 700, 420, 7,
           "### 1 · Fetch\nRuns every hour (or by hand). Reads every RSS feed listed in **Config**."),
    sticky("Note: Filter", [680, 180], 460, 420, 7,
           "### 2 · Free filter\nDrops *[For Hire]* posts, off-topic posts and anything already "
           "checked. Caps how many go to the AI."),
    sticky("Note: AI", [1180, 180], 460, 420, 7,
           "### 3 · AI scoring\nDeepSeek returns json: fit score 0-10, budget, effort, "
           "difficulty, a one-line summary and scam red flags."),
    sticky("Note: Send", [1680, 180], 460, 420, 7,
           "### 4 · Notify\nKeeps gigs with score ≥ `minScore` and sends them to Telegram, "
           "best first."),

    node("Every hour", "n8n-nodes-base.scheduleTrigger", 1.2, [0, Y - 80],
         {"rule": {"interval": [{"field": "hours", "hoursInterval": 1}]}}),
    node("Test by hand", "n8n-nodes-base.manualTrigger", 1, [0, Y + 80], {}),
    code("Config", [220, Y], "config.js"),
    code("List feeds", [420, Y], "list-feeds.js"),
    node("Read feeds", "n8n-nodes-base.rssFeedRead", 1.2, [600, Y - 0],
         {"url": "={{ $json.url }}", "options": {}},
         onError="continueRegularOutput"),
    code("Clean & pre-filter", [760, Y], "prefilter.js"),
    code("Only new posts", [980, Y], "only-new.js"),
    code("Build AI request", [1240, Y], "build-ai-request.js"),
    node("DeepSeek: score gig", "n8n-nodes-base.httpRequest", 4.2, [1460, Y],
         {
             "method": "POST",
             "url": "https://api.deepseek.com/chat/completions",
             "authentication": "genericCredentialType",
             "genericAuthType": "httpHeaderAuth",
             "sendBody": True,
             "specifyBody": "json",
             "jsonBody": "={{ JSON.stringify($json.requestBody) }}",
             "options": {
                 "batching": {"batch": {"batchSize": 3, "batchInterval": 1000}},
                 "timeout": 60000,
             },
         },
         retryOnFail=True, maxTries=3, waitBetweenTries=3000,
         onError="continueRegularOutput"),
    code("Pick the good ones", [1760, Y], "pick-good-ones.js"),
    node("Send to Telegram", "n8n-nodes-base.telegram", 1.2, [1980, Y],
         {
             "chatId": "={{ $json.chatId }}",
             "text": "={{ $json.message }}",
             "additionalFields": {
                 "appendAttribution": False,
                 "parse_mode": "HTML",
                 "disable_web_page_preview": True,
             },
         }),
]


def link(*names):
    return {"main": [[{"node": n, "type": "main", "index": 0} for n in names]]}


connections = {
    "Every hour": link("Config"),
    "Test by hand": link("Config"),
    "Config": link("List feeds"),
    "List feeds": link("Read feeds"),
    "Read feeds": link("Clean & pre-filter"),
    "Clean & pre-filter": link("Only new posts"),
    "Only new posts": link("Build AI request"),
    "Build AI request": link("DeepSeek: score gig"),
    "DeepSeek: score gig": link("Pick the good ones"),
    "Pick the good ones": link("Send to Telegram"),
}

workflow = {
    "name": "Gig Radar – AI freelance gig finder",
    "nodes": nodes,
    "connections": connections,
    "pinData": {},
    "settings": {"executionOrder": "v1"},
    "meta": {"templateCredsSetupCompleted": False},
    "tags": [],
}

out = ROOT / "workflows" / "gig-radar.json"
out.write_text(json.dumps(workflow, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("wrote", out, len(nodes), "nodes")
