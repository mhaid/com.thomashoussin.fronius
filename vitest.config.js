import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.js"],
		setupFiles: ["./tests/setup.js"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["lib/device.js", "drivers/**/device.js"],
			exclude: [
				"node_modules/**",
				"tests/**",
				"app.js",
				".homeybuild/**",
				"drivers/GEN24-storage/**",
			],
			thresholds: {
				statements: 60,
				branches: 60,
				functions: 60,
				lines: 60,
			},
		},
		testTimeout: 10000,
		clearMocks: true,
		restoreMocks: true,
		globals: true,
	},
});
