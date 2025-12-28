import { afterEach, beforeEach, vi } from "vitest";

// Mock the Homey module globally
vi.mock("homey", async () => {
	const mocks = await import("./mocks/homey.js");
	return { default: mocks.default, ...mocks };
});

// Mock node-fetch
vi.mock("node-fetch", () => ({
	default: vi.fn(),
}));

// Mock node-cron for reporting tests
vi.mock("node-cron", async () => {
	const cronMock = await import("./mocks/cron.js");
	return { default: cronMock.default };
});

// Clear all mocks between tests
beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});
