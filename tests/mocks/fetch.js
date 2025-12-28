import { vi } from "vitest";

/**
 * Create a mock fetch function that returns a successful response
 * @param {object} responseData - The JSON data to return
 * @param {object} options - Options for the response
 * @param {number} options.status - HTTP status code (default: 200)
 * @param {boolean} options.ok - Response ok flag (default: true)
 */
export function createMockFetch(responseData, options = {}) {
	const { status = 200, ok = true } = options;

	return vi.fn().mockResolvedValue({
		ok,
		status,
		statusText: ok ? "OK" : "Error",
		json: () => Promise.resolve(responseData),
	});
}

/**
 * Create a mock fetch that returns an HTTP error
 * @param {number} status - HTTP status code (default: 500)
 */
export function createFailingFetch(status = 500) {
	return vi.fn().mockResolvedValue({
		ok: false,
		status,
		statusText: "Internal Server Error",
		json: () => Promise.reject(new Error("Cannot parse")),
	});
}

/**
 * Create a mock fetch that throws a network error
 */
export function createNetworkErrorFetch() {
	return vi.fn().mockRejectedValue(new Error("Network error"));
}

/**
 * Create a Fronius API response wrapper
 * @param {object} data - The Body.Data content
 */
export function createFroniusResponse(data) {
	return {
		Head: {
			RequestArguments: {},
			Status: { Code: 0, Reason: "", UserMessage: "" },
		},
		Body: {
			Data: data,
		},
	};
}
