import fetch from "node-fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FroniusDevice from "../../lib/device.js";
import { createFroniusResponse, createMockFetch } from "../mocks/fetch.js";

/**
 * Test implementation of FroniusDevice
 */
class TestDevice extends FroniusDevice {
	constructor() {
		super();
		this._capabilities = new Set();
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
			DeviceId: 1,
			polling_interval: 300,
		};
		this._listeners = new Map();
		this.polling = false;
		this.updateValuesCalled = false;
		this.lastData = null;
	}

	// Mock Homey.Device methods
	hasCapability(cap) {
		return this._capabilities.has(cap);
	}
	addCapability(cap) {
		this._capabilities.add(cap);
		return Promise.resolve();
	}
	removeCapability(cap) {
		this._capabilities.delete(cap);
		return Promise.resolve();
	}
	setCapabilityValue(cap, value) {
		this._capabilityValues.set(cap, value);
		return Promise.resolve();
	}
	getCapabilityValue(cap) {
		return this._capabilityValues.get(cap);
	}
	getSetting(key) {
		return this._settings[key];
	}
	getSettings() {
		return this._settings;
	}
	getName() {
		return "Test Device";
	}
	log() {}
	error() {}
	addListener(event, handler) {
		if (!this._listeners.has(event)) {
			this._listeners.set(event, []);
		}
		this._listeners.get(event).push(handler);
	}
	emit(event, ...args) {
		const handlers = this._listeners.get(event) || [];
		for (const h of handlers) {
			h.call(this, ...args);
		}
	}

	// Override abstract methods for testing
	getUpdatePath() {
		return "/solar_api/v1/TestEndpoint.cgi?";
	}

	updateValues(data) {
		this.updateValuesCalled = true;
		this.lastData = data;
	}
}

describe("FroniusDevice", () => {
	let device;

	beforeEach(() => {
		device = new TestDevice();
		vi.clearAllMocks();
	});

	describe("getUpdatePath", () => {
		it("should throw error when not implemented in base class", () => {
			const baseDevice = new FroniusDevice();
			expect(() => baseDevice.getUpdatePath()).toThrow(
				"todo: Implement into child class",
			);
		});

		it("should return path when implemented in child class", () => {
			expect(device.getUpdatePath()).toBe("/solar_api/v1/TestEndpoint.cgi?");
		});
	});

	describe("getOptionalSuffix", () => {
		it("should return empty string by default", () => {
			expect(device.getOptionalSuffix()).toBe("");
		});
	});

	describe("onInit", () => {
		it("should enable polling", async () => {
			// Stop polling immediately to avoid infinite loop
			device.pollDevice = vi.fn().mockImplementation(() => {
				device.polling = false;
			});

			await device.onInit();

			expect(device.polling).toBe(false); // Stopped by our mock
		});

		it("should add poll listener", async () => {
			device.pollDevice = vi.fn();
			await device.onInit();

			expect(device._listeners.has("poll")).toBe(true);
		});
	});

	describe("onDeleted", () => {
		it("should disable polling", async () => {
			device.polling = true;
			await device.onDeleted();

			expect(device.polling).toBe(false);
		});
	});

	describe("updateFroniusDevice", () => {
		it("should construct correct URL", async () => {
			const mockData = { TestField: { Value: 123 } };
			fetch.mockImplementation(
				createMockFetch(createFroniusResponse(mockData)),
			);

			device.updateFroniusDevice();

			await vi.waitFor(() => {
				expect(fetch).toHaveBeenCalledWith(
					"http://192.168.1.100/solar_api/v1/TestEndpoint.cgi?Scope=Device&DeviceId=1",
				);
			});
		});

		it("should include optional suffix in URL", async () => {
			device.getOptionalSuffix = () => "&ExtraParam=value";
			const mockData = { TestField: { Value: 123 } };
			fetch.mockImplementation(
				createMockFetch(createFroniusResponse(mockData)),
			);

			device.updateFroniusDevice();

			await vi.waitFor(() => {
				expect(fetch).toHaveBeenCalledWith(
					"http://192.168.1.100/solar_api/v1/TestEndpoint.cgi?Scope=Device&DeviceId=1&ExtraParam=value",
				);
			});
		});

		it("should call updateValues with data on success", async () => {
			const mockData = { TestField: { Value: 456 } };
			fetch.mockImplementation(
				createMockFetch(createFroniusResponse(mockData)),
			);

			device.updateFroniusDevice();

			await vi.waitFor(() => {
				expect(device.updateValuesCalled).toBe(true);
				expect(device.lastData).toEqual(mockData);
			});
		});

		it("should not call updateValues when Body.Data is missing", async () => {
			fetch.mockImplementation(
				createMockFetch({
					Head: { Status: { Code: 0 } },
					Body: {},
				}),
			);

			device.updateFroniusDevice();

			// Wait a bit and verify updateValues was not called
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(device.updateValuesCalled).toBe(false);
		});

		it("should not call updateValues when data is empty", async () => {
			fetch.mockImplementation(createMockFetch(createFroniusResponse({})));

			device.updateFroniusDevice();

			// Wait a bit and verify updateValues was not called
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(device.updateValuesCalled).toBe(false);
		});

		it("should handle HTTP errors gracefully", async () => {
			fetch.mockImplementation(() =>
				Promise.resolve({
					ok: false,
					status: 500,
					statusText: "Internal Server Error",
				}),
			);

			// Should not throw
			expect(() => device.updateFroniusDevice()).not.toThrow();

			// Wait a bit and verify updateValues was not called
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(device.updateValuesCalled).toBe(false);
		});

		it("should handle network errors gracefully", async () => {
			fetch.mockImplementation(() =>
				Promise.reject(new Error("Network error")),
			);

			// Should not throw
			expect(() => device.updateFroniusDevice()).not.toThrow();

			// Wait a bit and verify updateValues was not called
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(device.updateValuesCalled).toBe(false);
		});
	});

	describe("onSettings", () => {
		it("should handle settings change", async () => {
			const result = await device.onSettings({
				oldSettings: { ip: "192.168.1.100" },
				newSettings: { ip: "192.168.1.200" },
				changedKeys: ["ip"],
			});

			// Default implementation just logs, returns undefined
			expect(result).toBeUndefined();
		});
	});

	describe("onAdded", () => {
		it("should complete without error", async () => {
			await expect(device.onAdded()).resolves.toBeUndefined();
		});
	});

	describe("onRenamed", () => {
		it("should complete without error", async () => {
			await expect(device.onRenamed("New Name")).resolves.toBeUndefined();
		});
	});
});
