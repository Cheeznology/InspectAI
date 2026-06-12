const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const stylesSource = path.join(__dirname, 'src', 'webview', 'styles.css');
const stylesDestination = path.join(__dirname, 'dist', 'webview', 'styles.css');

function copyStyles() {
	fs.mkdirSync(path.dirname(stylesDestination), { recursive: true });
	fs.copyFileSync(stylesSource, stylesDestination);
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				if (location) {
					console.error(
						`    ${location.file}:${location.line}:${location.column}:`,
					);
				}
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyStylesPlugin = {
	name: 'copy-styles',

	setup(build) {
		build.onEnd(() => {
			copyStyles();
		});
	},
};

async function main() {
	copyStyles();

	const extensionCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	const webviewCtx = await esbuild.context({
		entryPoints: ['src/webview/app.tsx'],
		bundle: true,
		format: 'esm',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/webview/app.js',
		jsx: 'automatic',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin, copyStylesPlugin],
	});

	if (watch) {
		await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
		return;
	}

	await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
	await extensionCtx.dispose();
	await webviewCtx.dispose();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
