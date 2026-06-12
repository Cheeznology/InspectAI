import * as vscode from 'vscode';
import { BRAND_NAME } from '../brand';
import type { ReviewError, ReviewResult } from '../providers/aiProvider';
import type { StatusBarManager } from '../statusBar';
import type { CodeContext } from '../utils/codeExtractor';

export const FREE_REVIEW_LIMIT = 25;

type WebviewInboundMessage =
	| { type: 'welcome'; reviewCount: number; reviewLimit: number }
	| { type: 'loading' }
	| { type: 'result'; result: ReviewResult; context: CodeContext }
	| { type: 'error'; error: ReviewError }
	| {
			type: 'upgrade';
			reviewCount: number;
			reviewLimit: number;
			upgradeUrl: string;
	  };

type WebviewOutboundMessage =
	| { command: 'copyFix'; text: string }
	| { command: 'openUrl'; url: string }
	| { command: 'openSettings' }
	| { command: 'reviewFile' }
	| { command: 'reviewSelection' };

function getNonce(): string {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 32; i++) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}

export class ReviewPanel implements vscode.WebviewViewProvider {
	public static currentPanel: ReviewPanel | undefined;

	private _view: vscode.WebviewView | undefined;
	private readonly _extensionUri: vscode.Uri;
	private readonly _statusBar: StatusBarManager;
	private readonly _onReviewFile: () => void;
	private readonly _onReviewSelection: () => void;
	private readonly _getReviewCount: () => number;
	private _nonce = getNonce();

	constructor(
		extensionUri: vscode.Uri,
		statusBar: StatusBarManager,
		onReviewFile: () => void,
		onReviewSelection: () => void,
		getReviewCount: () => number,
	) {
		this._extensionUri = extensionUri;
		this._statusBar = statusBar;
		this._onReviewFile = onReviewFile;
		this._onReviewSelection = onReviewSelection;
		this._getReviewCount = getReviewCount;
		ReviewPanel.currentPanel = this;
	}

	public static createOrShow(extensionUri: vscode.Uri): ReviewPanel {
		if (!ReviewPanel.currentPanel) {
			throw new Error('ReviewPanel has not been initialized.');
		}

		void vscode.commands.executeCommand('workbench.view.extension.inspectai');
		ReviewPanel.currentPanel.showWelcome();
		return ReviewPanel.currentPanel;
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist')],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		webviewView.onDidDispose(() => {
			this._view = undefined;
		});

		webviewView.webview.onDidReceiveMessage(
			async (message: WebviewOutboundMessage) => {
				if (!message || typeof message !== 'object' || !('command' in message)) {
					return;
				}

				switch (message.command) {
					case 'copyFix':
						if (typeof message.text === 'string') {
							await vscode.env.clipboard.writeText(message.text);
							void vscode.window.showInformationMessage(
								`${BRAND_NAME}: Fix copied to clipboard`,
							);
						}
						break;
					case 'openUrl':
						if (typeof message.url === 'string' && message.url.length > 0) {
							await vscode.env.openExternal(vscode.Uri.parse(message.url));
						}
						break;
					case 'openSettings':
						await vscode.commands.executeCommand(
							'workbench.action.openSettings',
							'inspectai',
						);
						break;
					case 'reviewFile':
						this._onReviewFile();
						break;
					case 'reviewSelection':
						this._onReviewSelection();
						break;
				}
			},
		);

		this.showWelcome();
	}

	public showWelcome(): void {
		this.postMessage({
			type: 'welcome',
			reviewCount: this._getReviewCount(),
			reviewLimit: FREE_REVIEW_LIMIT,
		});
	}

	public showLoading(): void {
		this._statusBar.setReviewing();
		this.postMessage({ type: 'loading' });
	}

	public showResult(result: ReviewResult, context: CodeContext): void {
		this._statusBar.setDone();
		this.postMessage({ type: 'result', result, context });
	}

	public showError(error: ReviewError): void {
		this._statusBar.setError();
		this.postMessage({ type: 'error', error });
	}

	public showUpgrade(reviewCount: number): void {
		this._statusBar.setError();
		this.postMessage({
			type: 'upgrade',
			reviewCount,
			reviewLimit: FREE_REVIEW_LIMIT,
			upgradeUrl: 'https://inspectai.dev/upgrade',
		});
	}

	public dispose(): void {
		ReviewPanel.currentPanel = undefined;
		this._view = undefined;
	}

	private postMessage(message: WebviewInboundMessage): void {
		void this._view?.webview.postMessage(message);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'app.js'),
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'styles.css'),
		);
		const nonce = this._nonce;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>InspectAI Review</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		window.vscode = vscode;
	</script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}
