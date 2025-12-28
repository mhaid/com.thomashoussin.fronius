import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * These tests validate that HTML onclick handlers match the JavaScript
 * function definitions in the same file.
 *
 * Background: The linter (Biome) may flag inline JavaScript functions
 * as "unused" because it doesn't analyze HTML attributes. This can lead
 * to automatic renaming (e.g., doSubmit -> _doSubmit) which breaks the
 * onclick handlers.
 *
 * This test suite prevents such regressions by verifying that:
 * 1. Every onclick handler references an existing function
 * 2. Function names are not prefixed with underscore (which would indicate
 *    the linter incorrectly marked them as unused)
 */

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const DRIVERS_DIR = join(PROJECT_ROOT, "drivers");

/**
 * Extract onclick handler function names from HTML content
 */
function extractOnclickHandlers(html) {
	const handlers = [];
	// Match onclick="functionName()" or onclick='functionName()'
	const regex = /onclick\s*=\s*["']([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
	let match = regex.exec(html);
	while (match !== null) {
		handlers.push(match[1]);
		match = regex.exec(html);
	}
	return handlers;
}

/**
 * Extract function definitions from JavaScript in HTML
 */
function extractFunctionDefinitions(html) {
	const functions = [];
	// Match function declarations: function name() or function name (
	const regex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
	let match = regex.exec(html);
	while (match !== null) {
		functions.push(match[1]);
		match = regex.exec(html);
	}
	return functions;
}

/**
 * Find all HTML files in the drivers directory
 */
function findHtmlFiles() {
	const htmlFiles = [];

	if (!existsSync(DRIVERS_DIR)) {
		return htmlFiles;
	}

	const drivers = readdirSync(DRIVERS_DIR, { withFileTypes: true });

	for (const driver of drivers) {
		if (!driver.isDirectory()) continue;

		const pairDir = join(DRIVERS_DIR, driver.name, "pair");
		if (!existsSync(pairDir)) continue;

		const files = readdirSync(pairDir);
		for (const file of files) {
			if (file.endsWith(".html")) {
				htmlFiles.push({
					driver: driver.name,
					file: file,
					path: join(pairDir, file),
				});
			}
		}
	}

	return htmlFiles;
}

describe("HTML Pairing Files", () => {
	const htmlFiles = findHtmlFiles();

	it("should find HTML pairing files", () => {
		expect(htmlFiles.length).toBeGreaterThan(0);
	});

	describe("onclick handlers validation", () => {
		for (const { driver, file, path } of htmlFiles) {
			describe(`${driver}/${file}`, () => {
				let html;
				let onclickHandlers;
				let functionDefs;

				try {
					html = readFileSync(path, "utf-8");
					onclickHandlers = extractOnclickHandlers(html);
					functionDefs = extractFunctionDefinitions(html);
				} catch {
					it("should be readable", () => {
						expect.fail(`Could not read file: ${path}`);
					});
					return;
				}

				if (onclickHandlers.length === 0) {
					it("has no onclick handlers (skipped)", () => {
						expect(true).toBe(true);
					});
					return;
				}

				it("should have matching function definitions for all onclick handlers", () => {
					for (const handler of onclickHandlers) {
						expect(
							functionDefs,
							`onclick handler "${handler}" not found in function definitions`,
						).toContain(handler);
					}
				});

				it("should not have underscore-prefixed function names (linter issue)", () => {
					for (const func of functionDefs) {
						expect(
							func.startsWith("_"),
							`Function "${func}" starts with underscore - likely incorrectly marked as unused by linter`,
						).toBe(false);
					}
				});

				it("should not have underscore-prefixed onclick handlers", () => {
					for (const handler of onclickHandlers) {
						expect(
							handler.startsWith("_"),
							`onclick handler "${handler}" starts with underscore - will not match renamed function`,
						).toBe(false);
					}
				});
			});
		}
	});

	describe("specific doSubmit validation", () => {
		it("should have doSubmit function (not _doSubmit) in all pairing files with submit", () => {
			for (const { driver, path } of htmlFiles) {
				const html = readFileSync(path, "utf-8");

				// Check if file uses doSubmit
				if (html.includes("doSubmit")) {
					const functionDefs = extractFunctionDefinitions(html);
					const onclickHandlers = extractOnclickHandlers(html);

					// If onclick references doSubmit, it should exist as a function
					if (onclickHandlers.includes("doSubmit")) {
						expect(
							functionDefs,
							`${driver}: doSubmit onclick handler exists but function is missing`,
						).toContain("doSubmit");
					}

					// Should not have _doSubmit (linter renaming issue)
					expect(
						functionDefs.includes("_doSubmit"),
						`${driver}: Found _doSubmit - linter may have incorrectly renamed the function`,
					).toBe(false);
				}
			}
		});
	});
});
