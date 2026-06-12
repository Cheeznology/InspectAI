# InspectAI — AI Code Review Inside VS Code

Catch bugs, security issues, and unreliable AI-generated code before you commit.

InspectAI reviews selected code directly inside VS Code, helping you identify potential issues without leaving your editor.

## Features

* 🔍 Bug detection

  * Logic errors
  * Edge cases
  * Null and undefined risks
  * Common coding mistakes

* 🔒 Security analysis

  * SQL injection risks
  * Hardcoded secrets
  * Unsafe patterns
  * Input validation issues

* 🤖 AI-generated code review

  * Detects suspicious implementations
  * Flags potentially incorrect API usage
  * Highlights code that deserves a closer manual review

* 📊 Risk scoring

  * Quick visual indication of overall code quality and risk

* ⚡ Integrated workflow

  * Review code directly inside VS Code
  * No copy-pasting required
  * Works from the editor context menu and command palette

## Try it with sample code

Clone this repo and open the `samples/` folder:

* `samples/01-clean-example.ts` — well-structured code (low risk)
* `samples/02-buggy-example.ts` — intentional bugs for demos (higher risk)

Select a function → right-click → **InspectAI: Review Selection**.

## Installation

Install InspectAI from the Visual Studio Code Marketplace.

Marketplace:

https://marketplace.visualstudio.com/items?itemName=cheeznology.inspectai

## Setup

1. Open VS Code Settings.

2. Search for:

   inspectai.apiKey

3. Enter your API key.

## Usage

### Review Selected Code

1. Select code in the editor.

2. Right-click.

3. Choose:

   InspectAI: Review Selection

4. View results in the InspectAI panel.

### Review an Entire File

1. Open a file.

2. Open the Command Palette:

   Ctrl+Shift+P

3. Run:

   InspectAI: Review File

## Requirements

* Valid API key
* VS Code 1.85 or newer

## Privacy

InspectAI processes code only when you request a review.

No review is performed automatically.

## 📬 Contact
- Email: cheeznology@gmail.com
- GitHu Issues: https://github.com/Cheeznology
---

InspectAI is an independent project and is not affiliated with any AI provider.
