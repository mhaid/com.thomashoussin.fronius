import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.js"],
		setupFiles: ["./tests/setup.js"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["lib/**/*.js", "drivers/**/device.js", "drivers/**/driver.js"],
			exclude: ["node_modules/**", "tests/**", "app.js", ".homeybuild/**"],
			thresholds: {
				statements: 70,
				branches: 60,
				functions: 70,
				lines: 70,
			},
		},
		testTimeout: 10000,
		clearMocks: true,
		restoreMocks: true,
		globals: true,
	},
});
