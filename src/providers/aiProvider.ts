import * as vscode from 'vscode';
import type { CodeContext } from '../utils/codeExtractor';

export interface ReviewIssue {
	id: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	type: 'bug' | 'security' | 'logic' | 'performance' | 'hallucination';
	line: number | null;
	title: string;
	description: string;
	fix: string;
}

export interface CodeQuality {
	readability: number;
	maintainability: number;
	security: number;
}

export interface ReviewResult {
	riskScore: number;
	summary: string;
	issues: ReviewIssue[];
	positives: string[];
	aiLikelihood: number;
	codeQuality?: CodeQuality;
	quickSummary?: string;
}

export interface ReviewError {
	type: 'no_key' | 'invalid_key' | 'rate_limit' | 'network' | 'unknown';
	message: string;
	actionLabel: string;
	actionUrl: string;
}

export class ReviewFailedError extends Error {
	constructor(public readonly reviewError: ReviewError) {
		super(reviewError.message);
		this.name = 'ReviewFailedError';
	}
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are InspectAI, an expert code reviewer with deep knowledge of security vulnerabilities, common bugs, performance issues, and best practices across all programming languages. Your reviews are specific, actionable, and educational.

Analyze the provided code and return ONLY a valid JSON object with this exact structure:

{
  "riskScore": <integer 0-100>,
  "summary": "<2-3 sentence summary: what the code does, main concerns, overall quality assessment>",
  "issues": [
    {
      "id": "issue_1",
      "severity": "critical|high|medium|low",
      "type": "bug|security|logic|performance|hallucination",
      "line": <line number as integer, or null>,
      "title": "<short descriptive title, max 8 words>",
      "description": "<clear explanation of WHY this is a problem, what could go wrong, and real-world impact>",
      "fix": "<specific corrected code or step-by-step fix instructions>"
    }
  ],
  "positives": ["<specific things the code does well — be specific, not generic>"],
  "aiLikelihood": <integer 0-100>,
  "codeQuality": {
    "readability": <integer 1-10>,
    "maintainability": <integer 1-10>,
    "security": <integer 1-10>
  },
  "quickSummary": "<one sentence, plain English, what a non-technical person needs to know about this code>"
}

Severity guide:
- critical: can cause data loss, security breach, app crash, or financial harm
- high: likely causes bugs in production, significant security risk
- medium: code smell, performance issue, or maintainability concern
- low: minor style issue, suggestion, or best practice

Risk score guide:
- 0-20: clean code, ready to commit
- 21-40: minor issues, review before committing
- 41-60: notable concerns, should fix before production
- 61-80: significant issues, needs refactoring
- 81-100: critical problems, do not commit

Rules:
- Only flag REAL issues. Never invent problems.
- Be specific about line numbers whenever possible.
- Fix suggestions must be concrete and copy-pasteable when possible.
- For security issues, explain the attack vector (e.g. "an attacker could inject SQL like: ' OR 1=1 --")
- If the code is genuinely clean, riskScore should be under 20 and issues array empty.
- Always find at least one positive if the code is reasonable.
- Return ONLY the JSON object. No markdown. No explanation. No preamble.`;

const SEVERITIES = new Set<ReviewIssue['severity']>([
	'critical',
	'high',
	'medium',
	'low',
]);

const ISSUE_TYPES = new Set<ReviewIssue['type']>([
	'bug',
	'security',
	'logic',
	'performance',
	'hallucination',
]);

interface GroqResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: {
		message?: string;
		type?: string;
		code?: string;
	};
}

function fail(error: ReviewError): never {
	throw new ReviewFailedError(error);
}

function buildUserMessage(language: string, code: string): string {
	return `Review this ${language} code:\n\n${code}`;
}

function extractJsonObject(raw: string): Record<string, unknown> {
	let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
	const start = cleaned.indexOf('{');
	const end = cleaned.lastIndexOf('}');

	if (start === -1 || end === -1) {
		fail({
			type: 'unknown',
			message: 'Something went wrong: No JSON object found in response',
			actionLabel: '',
			actionUrl: '',
		});
	}

	cleaned = cleaned.substring(start, end + 1);

	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		fail({
			type: 'unknown',
			message: `Something went wrong: ${detail}`,
			actionLabel: '',
			actionUrl: '',
		});
	}

	if (!parsed || typeof parsed !== 'object') {
		fail({
			type: 'unknown',
			message: 'Something went wrong: invalid review payload',
			actionLabel: '',
			actionUrl: '',
		});
	}

	return parsed as Record<string, unknown>;
}

function isReviewIssue(value: unknown): value is ReviewIssue {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const issue = value as Record<string, unknown>;

	return (
		typeof issue.id === 'string' &&
		typeof issue.severity === 'string' &&
		SEVERITIES.has(issue.severity as ReviewIssue['severity']) &&
		typeof issue.type === 'string' &&
		ISSUE_TYPES.has(issue.type as ReviewIssue['type']) &&
		(issue.line === null || typeof issue.line === 'number') &&
		typeof issue.title === 'string' &&
		typeof issue.description === 'string' &&
		typeof issue.fix === 'string'
	);
}

function clampQualityScore(value: number): number {
	return Math.max(1, Math.min(10, Math.round(value)));
}

function parseCodeQuality(value: unknown): CodeQuality | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}

	const quality = value as Record<string, unknown>;

	if (
		typeof quality.readability !== 'number' ||
		typeof quality.maintainability !== 'number' ||
		typeof quality.security !== 'number'
	) {
		return undefined;
	}

	return {
		readability: clampQualityScore(quality.readability),
		maintainability: clampQualityScore(quality.maintainability),
		security: clampQualityScore(quality.security),
	};
}

function parseReviewResult(raw: string): ReviewResult {
	const result = extractJsonObject(raw);

	const riskScore =
		typeof result.riskScore === 'number' ? result.riskScore : 0;
	const summary = typeof result.summary === 'string' ? result.summary : '';
	const aiLikelihood =
		typeof result.aiLikelihood === 'number' ? result.aiLikelihood : 0;
	const quickSummary =
		typeof result.quickSummary === 'string' && result.quickSummary.trim()
			? result.quickSummary.trim()
			: undefined;
	const codeQuality = parseCodeQuality(result.codeQuality);

	let issues: ReviewIssue[] = [];
	if (Array.isArray(result.issues)) {
		issues = result.issues.filter(isReviewIssue);
	}

	let positives: string[] = [];
	if (Array.isArray(result.positives)) {
		positives = result.positives.filter((item) => typeof item === 'string');
	}

	const review: ReviewResult = {
		riskScore,
		summary,
		issues,
		positives,
		aiLikelihood,
	};

	if (codeQuality) {
		review.codeQuality = codeQuality;
	}

	if (quickSummary) {
		review.quickSummary = quickSummary;
	}

	return review;
}

function mapHttpError(status: number, bodyText: string): ReviewError {
	const lowerBody = bodyText.toLowerCase();

	if (
		status === 401 ||
		lowerBody.includes('invalid_api_key') ||
		lowerBody.includes('authentication')
	) {
		return {
			type: 'invalid_key',
			message: 'Invalid API key. Get a free key at console.groq.com → API Keys',
			actionLabel: 'Open Groq Console',
			actionUrl: 'https://console.groq.com',
		};
	}

	if (status === 429 || lowerBody.includes('rate_limit')) {
		return {
			type: 'rate_limit',
			message:
				'Rate limit reached. Wait 60 seconds. (Free tier: 30 requests/minute)',
			actionLabel: '',
			actionUrl: '',
		};
	}

	return {
		type: 'unknown',
		message: `Something went wrong: ${bodyText || `HTTP ${status}`}`,
		actionLabel: '',
		actionUrl: '',
	};
}

export class AIProvider {
	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	async reviewCode(context: CodeContext): Promise<ReviewResult> {
		const apiKey =
			vscode.workspace.getConfiguration('inspectai').get<string>('apiKey') ?? '';

		if (!apiKey.trim()) {
			fail({
				type: 'no_key',
				message:
					'No API key. Open Settings (Ctrl+,), search inspectai.apiKey, paste your free Groq key from console.groq.com',
				actionLabel: 'Get Free Groq Key',
				actionUrl: 'https://console.groq.com',
			});
		}

		this.outputChannel.appendLine(
			`[${new Date().toISOString()}] Starting review: ${context.fileName} (${context.language})`,
		);

		let response: Response;
		try {
			response = await fetch(GROQ_URL, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey.trim()}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: GROQ_MODEL,
					messages: [
						{ role: 'system', content: SYSTEM_PROMPT },
						{
							role: 'user',
							content: buildUserMessage(context.language, context.code),
						},
					],
					temperature: 0.3,
					max_tokens: 2000,
				}),
			});
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(`Network error: ${detail}`);
			fail({
				type: 'network',
				message: 'Connection failed. Check your internet.',
				actionLabel: '',
				actionUrl: '',
			});
		}

		const bodyText = await response.text();
		let data: GroqResponse = {};

		if (bodyText) {
			try {
				data = JSON.parse(bodyText) as GroqResponse;
			} catch {
				this.outputChannel.appendLine('Failed to parse API response JSON.');
				fail({
					type: 'unknown',
					message: 'Something went wrong: invalid API response',
					actionLabel: '',
					actionUrl: '',
				});
			}
		}

		const apiErrorMessage = data.error?.message ?? '';
		const combinedErrorText = `${apiErrorMessage} ${bodyText}`;

		if (!response.ok || apiErrorMessage) {
			const reviewError = mapHttpError(response.status, combinedErrorText);
			this.outputChannel.appendLine(
				`API error (${response.status}): ${reviewError.message}`,
			);
			fail(reviewError);
		}

		const text = data.choices?.[0]?.message?.content?.trim() ?? '';
		if (!text) {
			this.outputChannel.appendLine('API returned an empty review response.');
			fail({
				type: 'unknown',
				message: 'Something went wrong: empty review response',
				actionLabel: '',
				actionUrl: '',
			});
		}

		try {
			const result = parseReviewResult(text);
			this.outputChannel.appendLine(
				`Review complete — risk ${result.riskScore}, ${result.issues.length} issue(s)`,
			);
			return result;
		} catch (error) {
			if (error instanceof ReviewFailedError) {
				this.outputChannel.appendLine(`Review error: ${error.reviewError.message}`);
				throw error;
			}

			const detail = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(`Review error: ${detail}`);
			fail({
				type: 'unknown',
				message: `Something went wrong: ${detail}`,
				actionLabel: '',
				actionUrl: '',
			});
		}
	}
}
