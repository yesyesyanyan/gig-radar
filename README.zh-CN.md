# 📡 Gig Radar 接单雷达

**一个 n8n 工作流：自动找自动化类的小额付费外包，用 AI 打分，只把合适的推送到你的 Telegram。**

它每小时读取一次 Reddit 和 n8n 官方社区的招聘板块，先免费过滤掉噪音（自我推销的帖子、不相关的、看过的），
再让 **DeepSeek** 按照*你的*技能给剩下的每条帖子打 0–10 分，只把高分的发到你手机上。

[English →](README.md)

<p align="center"><img src="docs/telegram.jpg" width="320" alt="Telegram 推送截图"></p>

![n8n 实际运行截图](docs/n8n-canvas.jpg)

*真实运行（Windows + `npx n8n`）：抓到 125 条帖子 → 免费预筛后剩 7 条 → DeepSeek 逐条打分 → 推送 1 条。*

## 工作流程

定时触发 → 读取 RSS → 免费预筛 → 去重 + 限量 → DeepSeek 打分（JSON 输出）→ 分数 ≥ 7 → Telegram 推送

AI 会给出：匹配分数、预算、工作量、难度、一句话摘要，以及**诈骗风险提示**。摘要默认是英文，想要中文就把 Config 里的 `summaryLanguage` 改成 `'Simplified Chinese'`。

## 快速上手

1. **运行 n8n**：装好 Node.js（LTS 版）后在命令行执行 `npx n8n`（Windows 也可以直接双击 `start-n8n-windows.bat`），或者用 Docker：`docker compose up -d`。
   浏览器打开 <http://localhost:5678>，注册本地账号。
2. **导入工作流**：Workflows → Create → 右上角 ⋯ → Import from file → 选 `workflows/gig-radar.json`。
3. **填密钥**
   - **DeepSeek: score gig** 节点 → 新建 *Header Auth* 凭据：Name 填 `Authorization`，Value 填 `Bearer sk-你的key`
     （在 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 获取）。
   - **Send to Telegram** 节点 → 新建 *Telegram API* 凭据，填入机器人 token（在 Telegram 里找 [@BotFather](https://t.me/BotFather)，发送 `/newbot` 创建）。
   - **获取 chat ID**：先给你的机器人随便发一条消息，然后在浏览器打开
     `https://api.telegram.org/bot<你的TOKEN>/getUpdates`，复制 `"chat":{"id": …}` 里的数字。
4. **改 Config 节点**：`telegramChatId` 填上一步的数字；`myProfile` 写几句你的技能和想接的活，AI 就是按这段话打分的，写得越具体越准。
5. **测试并启用**：点 **Test workflow**。如果没收到消息，可以先把 `minScore` 临时改成 `0` 看看 AI 都打了什么分。
   没问题后点右上角 **Publish**（旧版 n8n 是打开 **Active** 开关），之后只要电脑上的 n8n 开着，就会每小时自动运行。

## 费用

用 `deepseek-flash` 模型，每条帖子打分大约 **0.0005 美元**，预筛之后一天通常只剩几十条，一个月也就几美分。
上限由 `maxAiChecksPerRun`（默认 15）× 每天 24 次控制。

## 注意事项

- “已看过”的记录只在发布（Publish）后的自动运行中保存；手动测试时每次都当作新帖，这是正常的。
- AI 调用失败（比如余额不足）的帖子，下一轮会自动重试，不会丢。
- Reddit 的 RSS 有频率限制，多个版块请合并成一个链接（`r/a+b+c/new/.rss`），不要比每 15 分钟更频繁。
- Upwork 和 Fiverr 没有 RSS，所以没有包含在内。
- AI 也会看错，接单前一定要看原帖；任何要求你先付钱的“客户”都不要理。
