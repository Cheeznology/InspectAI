import * as vscode from 'vscode';
import {
	reviewFileCommand,
	reviewSelectionCommand,
	type ReviewCommandDeps,
} from './commands/reviewCode';
import { FREE_REVIEW_LIMIT, ReviewPanel } from './panels/ReviewPanel';
import { AIProvider } from './providers/aiProvider';
import { BRAND_NAME } from './brand';
import { StatusBarManager } from './statusBar';

const issueDecorationTypes: vscode.TextEditorDecorationType[] = [];

function getCurrentMonth(): string {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	return `${now.getFullYear()}-${month}`;
}

function clearIssueDecorations(): void {
	for (const editor of vscode.window.visibleTextEditors) {
		for (const decorationType of issueDecorationTypes) {
			editor.setDecorations(decorationType, []);
		}
	}
}

async function ensureReviewMonth(context: vscode.ExtensionContext): Promise<void> {
	const currentMonth = getCurrentMonth();
	const storedMonth = context.globalState.get<string>('inspectai.reviewMonth');

	if (storedMonth !== currentMonth) {
		await context.globalState.update('inspectai.reviewMonth', currentMonth);
		await context.globalState.update('inspectai.reviewCount', 0);
	}
}

function getReviewCount(context: vscode.ExtensionContext): number {
	return context.globalState.get<number>('inspectai.reviewCount', 0);
}

function hasLicenseKey(): boolean {
	return vscode.workspace
		.getConfiguration('inspectai')
		.get<string>('licenseKey', '')
		.trim().length > 0;
}

function isReviewAllowed(context: vscode.ExtensionContext): boolean {
	if (hasLicenseKey()) {
		return true;
	}
	return getReviewCount(context) < FREE_REVIEW_LIMIT;
}

export function activate(context: vscode.ExtensionContext): void {
	const extensionUri = context.extensionUri;
	const outputChannel = vscode.window.createOutputChannel(BRAND_NAME);
	const statusBar = new StatusBarManager();
	const aiProvider = new AIProvider(outputChannel);

	let reviewPanel: ReviewPanel;

	const getReviewDeps = (): ReviewCommandDeps => ({
		panel: reviewPanel,
		aiProvider,
		statusBar,
		extensionContext: context,
		isReviewAllowed: () => isReviewAllowed(context),
		onReviewBlocked: () => {
			reviewPanel.showUpgrade(getReviewCount(context));
		},
		onReviewComplete: async () => {
			const nextCount = getReviewCount(context) + 1;
			await context.globalState.update('inspectai.reviewCount', nextCount);
		},
	});

	const runReviewSelection = () => reviewSelectionCommand(getReviewDeps())();
	const runReviewFile = () => reviewFileCommand(getReviewDeps())();

	reviewPanel = new ReviewPanel(
		extensionUri,
		statusBar,
		() => void runReviewFile(),
		() => void runReviewSelection(),
		() => getReviewCount(context),
	);

	const openPanel = () => {
		void vscode.commands.executeCommand('workbench.view.extension.inspectai');
		reviewPanel.showWelcome();
	};

	void ensureReviewMonth(context).then(async () => {
		const hasShownWelcome = context.globalState.get<boolean>(
			'inspectai.hasShownWelcome',
		);

		if (!hasShownWelcome) {
			void vscode.window
				.showInformationMessage(
					`${BRAND_NAME} is active! Select any code → right-click → ${BRAND_NAME}: Review Selection to start.`,
					'Got it',
				)
				.then((choice) => {
					if (choice === 'Got it') {
						void context.globalState.update('inspectai.hasShownWelcome', true);
					}
				});

			openPanel();
			await context.globalState.update('inspectai.hasShownWelcome', true);
		}
	});

	context.subscriptions.push(
		outputChannel,
		statusBar,
		vscode.window.registerWebviewViewProvider('inspectaiReview', reviewPanel, {
			webviewOptions: { retainContextWhenHidden: true },
		}),

		vscode.commands.registerCommand('inspectai.openPanel', openPanel),

		vscode.commands.registerCommand('inspectai.reviewSelection', async () => {
			await ensureReviewMonth(context);
			openPanel();
			await runReviewSelection();
		}),

		vscode.commands.registerCommand('inspectai.reviewFile', async () => {
			await ensureReviewMonth(context);
			openPanel();
			await runReviewFile();
		}),

		vscode.commands.registerCommand('inspectai.clearDecorations', () => {
			clearIssueDecorations();
			void vscode.window.showInformationMessage(
				`${BRAND_NAME}: Issue highlights cleared.`,
			);
		}),

		vscode.commands.registerCommand('inspectai.openSettings', () => {
			void vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'inspectai',
			);
		}),
	);
}

export function deactivate(): void {
	ReviewPanel.currentPanel?.dispose();
}
