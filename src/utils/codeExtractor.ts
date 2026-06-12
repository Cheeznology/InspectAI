import * as path from 'path';
import * as vscode from 'vscode';

export interface CodeContext {
	code: string;
	language: string;
	fileName: string;
	isSelection: boolean;
}

/**
 * Extracts code from the active editor — either the current selection or the full file.
 */
export function extractCode(
	editor: vscode.TextEditor,
	useSelection: boolean,
): CodeContext {
	const { document, selection } = editor;
	const hasSelection = !selection.isEmpty;

	const useSelectedText = useSelection && hasSelection;

	return {
		code: useSelectedText ? document.getText(selection) : document.getText(),
		language: document.languageId,
		fileName: path.basename(document.fileName),
		isSelection: useSelectedText,
	};
}
