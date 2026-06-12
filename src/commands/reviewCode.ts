import * as vscode from 'vscode';
import { BRAND_NAME } from '../brand';
import { ReviewPanel } from '../panels/ReviewPanel';
import { AIProvider, ReviewFailedError } from '../providers/aiProvider';
import type { StatusBarManager } from '../statusBar';
import { extractCode } from '../utils/codeExtractor';

export interface ReviewCommandDeps {
	panel: ReviewPanel;
	aiProvider: AIProvider;
	statusBar: StatusBarManager;
	extensionContext: vscode.ExtensionContext;
	onReviewComplete: () => Promise<void>;
	isReviewAllowed: () => boolean;
	onReviewBlocked: () => void;
}

async function runReview(
	deps: ReviewCommandDeps,
	useSelection: boolean,
): Promise<void> {
	if (!deps.isReviewAllowed()) {
		deps.onReviewBlocked();
		return;
	}

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		deps.statusBar.setError();
		void vscode.window.showErrorMessage(
			`${BRAND_NAME}: Open a file with code to review.`,
		);
		return;
	}

	const context = extractCode(editor, useSelection);
	deps.panel.showLoading();

	try {
		const result = await deps.aiProvider.reviewCode(context);
		await deps.onReviewComplete();
		deps.panel.showResult(result, context);
	} catch (error) {
		if (error instanceof ReviewFailedError) {
			deps.panel.showError(error.reviewError);
		} else {
			const detail = error instanceof Error ? error.message : 'Unknown error';
			deps.panel.showError({
				type: 'unknown',
				message: `Something went wrong: ${detail}`,
				actionLabel: '',
				actionUrl: '',
			});
		}
	}
}

export function reviewSelectionCommand(
	deps: ReviewCommandDeps,
): () => Promise<void> {
	return () => runReview(deps, true);
}

export function reviewFileCommand(deps: ReviewCommandDeps): () => Promise<void> {
	return () => runReview(deps, false);
}
