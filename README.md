# VerifAI — AI Code Review Inside VS Code

**Catch bugs, security issues, and AI hallucinations before you commit.**

VerifAI uses Claude AI to review your code instantly, right inside your editor.
No copy-pasting into ChatGPT. No switching tabs. One right-click.

![VerifAI in action](media/screenshot.png)

---

## What It Does

- 🔍 **Bug detection** — finds logic errors, null pointer risks, off-by-one errors
- 🔒 **Security scanning** — catches SQL injection, hardcoded secrets, XSS risks
- 🤖 **AI hallucination detection** — flags methods and APIs that don't exist
- ⚡ **Instant results** — review appears in a panel inside your editor in seconds
- 📊 **Risk score** — 0-100 score so you know at a glance how risky the code is

---

## How To Use

**Step 1 — Add your API key**
Open Settings (`Ctrl+,`), search `verifai.apiKey`, paste your
[Anthropic API key](https://console.anthropic.com/settings/keys).

**Step 2 — Select code**
Highlight any code in your editor.

**Step 3 — Right-click → VerifAI: Review Selection**
Results appear instantly in the VerifAI panel on the right.

> You can also review an entire file: right-click anywhere → **VerifAI: Review File**
> Or use the Command Palette: `Ctrl+Shift+P` → type `VerifAI`

---

## Requirements

- An [Anthropic API key](https://console.anthropic.com) (free to create, ~$0.001 per review)
- VS Code 1.85 or higher

---

## Pricing

| Tier | Price | Reviews |
|------|-------|---------|
| Free | $0 | 25 reviews/month |
| Starter | $4.99/month | Unlimited |
| Pro | $9.99/month | Unlimited + team features |

[Upgrade here](https://verifai.dev/upgrade)

---

## Privacy

Your code is sent to Anthropic's Claude API using **your own API key**.
VerifAI itself never stores, logs, or transmits your code anywhere else.

---

## Support

- Email: cheeznology@gmail.com
- Issues: [GitHub](https://github.com/Cheeznology/verifai)

---

*VerifAI is not affiliated with Anthropic.*
