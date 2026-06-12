import * as vscode from 'vscode';
import { BRAND_NAME } from './brand';

const ERROR_COLOR = '#F14C4C';
const RESET_DELAY_MS = 3000;
const STATUS_BAR_ID = 'inspectai.status';

const IDLE_TEXT = `$(shield) ${BRAND_NAME} ✓`;
const ACTIVE_BACKGROUND = new vscode.ThemeColor(
	'statusBarItem.warningBackground',
);

export class StatusBarManager implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;
	private resetTimer: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		this.item = vscode.window.createStatusBarItem(
			STATUS_BAR_ID,
			vscode.StatusBarAlignment.Left,
			100,
		);
		this.item.name = BRAND_NAME;
		this.item.command = 'inspectai.openPanel';
		this.setIdle();
		this.item.show();
	}

	setIdle(): void {
		this.clearResetTimer();
		this.item.text = IDLE_TEXT;
		this.item.tooltip =
			`${BRAND_NAME} is active — right-click any code to review it`;
		this.item.color = undefined;
		this.item.backgroundColor = ACTIVE_BACKGROUND;
	}

	setReviewing(): void {
		this.clearResetTimer();
		this.item.text = `$(sync~spin) ${BRAND_NAME} ✓`;
		this.item.tooltip = `${BRAND_NAME} is analyzing your code`;
		this.item.color = undefined;
		this.item.backgroundColor = undefined;
	}

	setDone(): void {
		this.clearResetTimer();
		this.item.text = `$(pass-filled) ${BRAND_NAME} ✓`;
		this.item.tooltip = 'Review complete';
		this.item.color = new vscode.ThemeColor('testing.iconPassed');
		this.item.backgroundColor = undefined;
		this.resetTimer = setTimeout(() => this.setIdle(), RESET_DELAY_MS);
	}

	setError(): void {
		this.clearResetTimer();
		this.item.text = `$(error) ${BRAND_NAME} ✓`;
		this.item.tooltip = `Review failed — click to open ${BRAND_NAME}`;
		this.item.color = ERROR_COLOR;
		this.item.backgroundColor = new vscode.ThemeColor(
			'statusBarItem.errorBackground',
		);
		this.resetTimer = setTimeout(() => this.setIdle(), RESET_DELAY_MS);
	}

	dispose(): void {
		this.clearResetTimer();
		this.item.dispose();
	}

	private clearResetTimer(): void {
		if (this.resetTimer !== undefined) {
			clearTimeout(this.resetTimer);
			this.resetTimer = undefined;
		}
	}
}
