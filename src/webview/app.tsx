import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ReviewIssue {
	id: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	type: 'bug' | 'security' | 'logic' | 'performance' | 'hallucination';
	line: number | null;
	title: string;
	description: string;
	fix: string;
}

interface CodeQuality {
	readability: number;
	maintainability: number;
	security: number;
}

interface ReviewResult {
	riskScore: number;
	summary: string;
	issues: ReviewIssue[];
	positives: string[];
	aiLikelihood: number;
	codeQuality?: CodeQuality;
	quickSummary?: string;
}

interface CodeContext {
	code: string;
	language: string;
	fileName: string;
	isSelection: boolean;
}

interface InspectAiErrorInfo {
	type: string;
	message: string;
	actionLabel: string;
	actionUrl: string;
}

type InboundMessage =
	| { type: 'welcome'; reviewCount: number; reviewLimit: number }
	| { type: 'loading' }
	| { type: 'result'; result: ReviewResult; context: CodeContext }
	| { type: 'error'; error: InspectAiErrorInfo }
	| {
			type: 'upgrade';
			reviewCount: number;
			reviewLimit: number;
			upgradeUrl: string;
	  };

type ViewState =
	| { status: 'welcome'; reviewCount: number; reviewLimit: number }
	| { status: 'loading' }
	| { status: 'error'; error: InspectAiErrorInfo }
	| { status: 'upgrade'; reviewCount: number; reviewLimit: number; upgradeUrl: string }
	| { status: 'result'; result: ReviewResult; context: CodeContext };

interface VsCodeApi {
	postMessage(message: unknown): void;
}

declare global {
	interface Window {
		vscode?: VsCodeApi;
	}
}

function postCommand(command: string, payload: Record<string, string> = {}): void {
	window.vscode?.postMessage({ command, ...payload });
}

function riskClass(score: number): string {
	if (score <= 30) {
		return 'risk-circle risk-low';
	}
	if (score <= 69) {
		return 'risk-circle risk-medium';
	}
	return 'risk-circle risk-high';
}

function errorIcon(type: string): string {
	if (type === 'no_key' || type === 'invalid_key') {
		return '🔑';
	}
	if (type === 'network') {
		return '🌐';
	}
	return '⚠';
}

function WelcomeView({
	reviewCount,
	reviewLimit,
}: {
	reviewCount: number;
	reviewLimit: number;
}): React.JSX.Element {
	const steps = [
		'Open any code file',
		'Select the code you want reviewed',
		'Right-click → "InspectAI: Review Selection"',
	];

	return (
		<div className="welcome-state">
			<h1 className="welcome-title">InspectAI</h1>
			<p className="welcome-subtitle">Your AI code reviewer is active and ready</p>
			<p className="status-on">
				<span className="status-dot" aria-hidden="true" />
				Extension is ON
			</p>
			<hr className="divider" />
			<h2 className="section-heading">How to use:</h2>
			<div className="steps">
				{steps.map((text, index) => (
					<div className="step-card" key={text}>
						<span className="step-number">{index + 1}</span>
						<span className="step-text">{text}</span>
					</div>
				))}
			</div>
			<p className="review-usage">
				{reviewCount} of {reviewLimit} free reviews used this month
			</p>
			<button
				type="button"
				className="primary-button"
				onClick={() => postCommand('reviewFile')}
			>
				Review Current File
			</button>
			<p className="tip-text">Or use Ctrl+Shift+P → type InspectAI</p>
		</div>
	);
}

function LoadingView(): React.JSX.Element {
	return (
		<div className="loading-state">
			<div className="spinner" aria-hidden="true" />
			<p>Analyzing with Groq AI...</p>
		</div>
	);
}

function ErrorView({ error }: { error: InspectAiErrorInfo }): React.JSX.Element {
	const showSettings =
		error.type === 'no_key' || error.type === 'invalid_key';

	return (
		<div className="error-state" role="alert">
			<div className="error-icon">{errorIcon(error.type)}</div>
			<p className="error-message">{error.message}</p>
			<div className="error-actions">
				{error.actionLabel && error.actionUrl && (
					<button
						type="button"
						className="primary-button"
						onClick={() => postCommand('openUrl', { url: error.actionUrl })}
					>
						{error.actionLabel}
					</button>
				)}
				{showSettings && (
					<button
						type="button"
						className="secondary-button"
						onClick={() => postCommand('openSettings')}
					>
						Open Settings
					</button>
				)}
			</div>
		</div>
	);
}

function UpgradeView({
	reviewCount,
	reviewLimit,
	upgradeUrl,
}: {
	reviewCount: number;
	reviewLimit: number;
	upgradeUrl: string;
}): React.JSX.Element {
	return (
		<div className="upgrade-state">
			<div className="error-icon">⚠</div>
			<h2 className="upgrade-title">Free review limit reached</h2>
			<p className="error-message">
				You have used all {reviewLimit} free reviews this month ({reviewCount}/
				{reviewLimit}). Upgrade to continue reviewing code.
			</p>
			<button
				type="button"
				className="primary-button"
				onClick={() => postCommand('openUrl', { url: upgradeUrl })}
			>
				Upgrade to Pro
			</button>
			<button
				type="button"
				className="secondary-button"
				onClick={() => postCommand('openSettings')}
			>
				Enter License Key
			</button>
		</div>
	);
}

function issueTypeIcon(type: ReviewIssue['type']): string {
	switch (type) {
		case 'security':
			return '🔒 ';
		case 'performance':
			return '⚡ ';
		case 'bug':
			return '🐛 ';
		default:
			return '';
	}
}

function qualityBarClass(score: number): string {
	if (score >= 8) {
		return 'quality-bar-fill quality-high';
	}
	if (score >= 5) {
		return 'quality-bar-fill quality-medium';
	}
	return 'quality-bar-fill quality-low';
}

function CodeQualitySection({
	codeQuality,
}: {
	codeQuality: CodeQuality;
}): React.JSX.Element {
	const rows: Array<{ label: string; score: number }> = [
		{ label: 'Readability', score: codeQuality.readability },
		{ label: 'Maintainability', score: codeQuality.maintainability },
		{ label: 'Security', score: codeQuality.security },
	];

	return (
		<section className="code-quality-section">
			<h2 className="section-heading">Code Quality</h2>
			{rows.map((row) => (
				<div className="quality-row" key={row.label}>
					<div className="quality-label-row">
						<span className="quality-label">{row.label}</span>
						<span className="quality-score">{row.score}/10</span>
					</div>
					<div className="quality-bar-track">
						<div
							className={qualityBarClass(row.score)}
							style={{ width: `${(row.score / 10) * 100}%` }}
						/>
					</div>
				</div>
			))}
		</section>
	);
}

function TldrCard({ text }: { text: string }): React.JSX.Element {
	return (
		<div className="tldr-card">
			<span className="tldr-label">TL;DR</span>
			<p className="tldr-text">{text}</p>
		</div>
	);
}

function FixBlock({ fix }: { fix: string }): React.JSX.Element {
	const [expanded, setExpanded] = useState(false);
	const lines = fix.split('\n');
	const isLong = lines.length > 3;
	const visibleFix = isLong && !expanded ? lines.slice(0, 3).join('\n') : fix;

	return (
		<div className="fix-block">
			<div className="fix-header">
				{isLong && (
					<button
						type="button"
						className="show-more-button"
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded ? 'Show less' : 'Show more'}
					</button>
				)}
				<button
					type="button"
					className="copy-button"
					onClick={() => postCommand('copyFix', { text: fix })}
				>
					Copy Fix
				</button>
			</div>
			<pre className={`fix-code${isLong && !expanded ? ' fix-code-collapsed' : ''}`}>
				<code>{visibleFix}</code>
			</pre>
		</div>
	);
}

function IssueCard({ issue }: { issue: ReviewIssue }): React.JSX.Element {
	return (
		<article className={`issue-card severity-border-${issue.severity}`}>
			<div className="issue-meta">
				<span className={`pill severity-pill severity-${issue.severity}`}>
					{issue.severity}
				</span>
				<span className="pill type-pill">{issue.type}</span>
				{issue.line !== null && (
					<span className="pill line-pill line-pill-active">Line {issue.line}</span>
				)}
			</div>
			<h3 className="issue-title">
				{issueTypeIcon(issue.type)}
				{issue.title}
			</h3>
			<p className="issue-description">{issue.description}</p>
			<FixBlock fix={issue.fix} />
		</article>
	);
}

function PositivesSection({
	positives,
	defaultExpanded = false,
}: {
	positives: string[];
	defaultExpanded?: boolean;
}): React.JSX.Element | null {
	const [open, setOpen] = useState(defaultExpanded);

	if (positives.length === 0) {
		return null;
	}

	return (
		<section className="positives-section">
			<button
				type="button"
				className="positives-toggle"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
			>
				Positives ({positives.length})
				<span className="toggle-icon">{open ? '−' : '+'}</span>
			</button>
			{open && (
				<ul className="positives-list">
					{positives.map((item, index) => (
						<li key={`${item}-${index}`}>
							<span className="positive-dot" aria-hidden="true" />
							{item}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function ResultView({ result }: { result: ReviewResult }): React.JSX.Element {
	const roundedRisk = Math.round(result.riskScore);
	const roundedAi = Math.round(result.aiLikelihood);
	const noIssues = result.issues.length === 0;

	return (
		<div className="result-view">
			<div className="risk-section">
				<div className={riskClass(roundedRisk)}>
					<span className="risk-value">{roundedRisk}</span>
				</div>
				<p className="risk-label">Risk Score</p>
			</div>

			<p className="ai-likelihood">
				AI-generated likelihood: {roundedAi}%
			</p>

			{result.codeQuality && (
				<CodeQualitySection codeQuality={result.codeQuality} />
			)}

			{result.summary && (
				<div className="summary-card">
					<p className="summary-text">{result.summary}</p>
				</div>
			)}

			{result.quickSummary && <TldrCard text={result.quickSummary} />}

			{noIssues ? (
				<div className="no-issues-block">
					<div className="no-issues-icon">✓</div>
					<p className="no-issues-title">No issues found</p>
				</div>
			) : (
				<section className="issues-section">
					<h2 className="issues-heading">
						Issues
						<span className="issues-count">{result.issues.length}</span>
					</h2>
					<div className="issues-list">
						{result.issues.map((issue) => (
							<IssueCard key={issue.id} issue={issue} />
						))}
					</div>
				</section>
			)}

			<PositivesSection
				positives={result.positives}
				defaultExpanded={noIssues}
			/>
		</div>
	);
}

function App(): React.JSX.Element {
	const [view, setView] = useState<ViewState>({
		status: 'welcome',
		reviewCount: 0,
		reviewLimit: 25,
	});

	useEffect(() => {
		const onMessage = (event: MessageEvent<InboundMessage>): void => {
			const message = event.data;
			if (!message || typeof message !== 'object' || !('type' in message)) {
				return;
			}

			switch (message.type) {
				case 'welcome':
					setView({
						status: 'welcome',
						reviewCount: message.reviewCount,
						reviewLimit: message.reviewLimit,
					});
					break;
				case 'loading':
					setView({ status: 'loading' });
					break;
				case 'result':
					setView({
						status: 'result',
						result: message.result,
						context: message.context,
					});
					break;
				case 'error':
					setView({ status: 'error', error: message.error });
					break;
				case 'upgrade':
					setView({
						status: 'upgrade',
						reviewCount: message.reviewCount,
						reviewLimit: message.reviewLimit,
						upgradeUrl: message.upgradeUrl,
					});
					break;
			}
		};

		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, []);

	return (
		<main className="app">
			{view.status === 'welcome' && (
				<WelcomeView
					reviewCount={view.reviewCount}
					reviewLimit={view.reviewLimit}
				/>
			)}
			{view.status === 'loading' && <LoadingView />}
			{view.status === 'error' && <ErrorView error={view.error} />}
			{view.status === 'upgrade' && (
				<UpgradeView
					reviewCount={view.reviewCount}
					reviewLimit={view.reviewLimit}
					upgradeUrl={view.upgradeUrl}
				/>
			)}
			{view.status === 'result' && <ResultView result={view.result} />}
		</main>
	);
}

const rootElement = document.getElementById('root');
if (rootElement) {
	createRoot(rootElement).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}
