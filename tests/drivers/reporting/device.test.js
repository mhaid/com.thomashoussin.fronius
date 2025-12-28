import fetch from "node-fetch";
import cron from "node-cron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Reporting from "../../../drivers/reporting/device.js";
import { createMockFetch } from "../../mocks/fetch.js";

/**
 * Test wrapper for Reporting device
 * Note: Reporting extends Homey.Device directly, not FroniusDevice
 */
class TestReporting extends Reporting {
	constructor() {
		super();
		this._capabilities = new Set([
			"meter_power.toGrid",
			"meter_power.fromGrid",
			"meter_power.produced",
			"selfconsumption",
			"selfconsumption.month",
			"spending.day",
			"savings.day",
			"spending.month",
			"savings.month",
			"spending.previousmonth",
			"button.recoverHistory",
			"button.resetHistory",
		]);
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
			DeviceId: 0,
			polling_interval: 300,
			purchaseprice: 0.25,
			sellprice: 0.1,
		};
		this._storeValues = new Map();
		this._listeners = new Map();
		this._capabilityListeners = new Map();
		this.polling = false;
		this.inverters = ["1"];
		this.dailycron = null;
		this.monthlycron = null;
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
	getStoreValue(key) {
		return this._storeValues.get(key) ?? 0;
	}
	setStoreValue(key, value) {
		this._storeValues.set(key, value);
		return Promise.resolve();
	}
	getName() {
		return "Test Reporting";
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
	registerCapabilityListener(cap, handler) {
		this._capabilityListeners.set(cap, handler);
	}
}

describe("Reporting", () => {
	let device;

	beforeEach(() => {
		device = new TestReporting();
		vi.clearAllMocks();

		// Initialize store values
		device._storeValues.set("meter_power.toGrid.today", 0);
		device._storeValues.set("meter_power.fromGrid.today", 0);
		device._storeValues.set("meter_power.produced.today", 0);
		device._storeValues.set("meter_power.toGrid.month", 0);
		device._storeValues.set("meter_power.fromGrid.month", 0);
		device._storeValues.set("meter_power.produced.month", 0);
		device._storeValues.set("meter_power.fromGrid.previousmonth", 0);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("everyday - Daily Rollover", () => {
		it("should add today values to month totals", async () => {
			device._storeValues.set("meter_power.toGrid.today", 10);
			device._storeValues.set("meter_power.toGrid.month", 100);
			device._storeValues.set("meter_power.fromGrid.today", 5);
			device._storeValues.set("meter_power.fromGrid.month", 50);
			device._storeValues.set("meter_power.produced.today", 15);
			device._storeValues.set("meter_power.produced.month", 150);

			await device.everyday();

			expect(device.getStoreValue("meter_power.toGrid.month")).toBe(110);
			expect(device.getStoreValue("meter_power.fromGrid.month")).toBe(55);
			expect(device.getStoreValue("meter_power.produced.month")).toBe(165);
		});

		it("should reset today values to 0", async () => {
			device._storeValues.set("meter_power.toGrid.today", 10);
			device._storeValues.set("meter_power.fromGrid.today", 5);
			device._storeValues.set("meter_power.produced.today", 15);

			await device.everyday();

			expect(device.getStoreValue("meter_power.toGrid.today")).toBe(0);
			expect(device.getStoreValue("meter_power.fromGrid.today")).toBe(0);
			expect(device.getStoreValue("meter_power.produced.today")).toBe(0);
		});
	});

	describe("everymonth - Monthly Rollover", () => {
		it("should save previous month total (month + today)", async () => {
			device._storeValues.set("meter_power.fromGrid.month", 200);
			device._storeValues.set("meter_power.fromGrid.today", 10);

			await device.everymonth();

			expect(device.getStoreValue("meter_power.fromGrid.previousmonth")).toBe(
				210,
			);
		});

		it("should reset all today values to 0", async () => {
			device._storeValues.set("meter_power.toGrid.today", 10);
			device._storeValues.set("meter_power.fromGrid.today", 5);
			device._storeValues.set("meter_power.produced.today", 15);

			await device.everymonth();

			expect(device.getStoreValue("meter_power.toGrid.today")).toBe(0);
			expect(device.getStoreValue("meter_power.fromGrid.today")).toBe(0);
			expect(device.getStoreValue("meter_power.produced.today")).toBe(0);
		});

		it("should reset all month values to 0", async () => {
			device._storeValues.set("meter_power.toGrid.month", 100);
			device._storeValues.set("meter_power.fromGrid.month", 50);
			device._storeValues.set("meter_power.produced.month", 150);

			await device.everymonth();

			expect(device.getStoreValue("meter_power.toGrid.month")).toBe(0);
			expect(device.getStoreValue("meter_power.fromGrid.month")).toBe(0);
			expect(device.getStoreValue("meter_power.produced.month")).toBe(0);
		});
	});

	describe("resetHistory", () => {
		it("should reset all month and previous month values to 0", async () => {
			device._storeValues.set("meter_power.toGrid.month", 100);
			device._storeValues.set("meter_power.fromGrid.month", 50);
			device._storeValues.set("meter_power.produced.month", 150);
			device._storeValues.set("meter_power.fromgrid.previousmonth", 200);

			await device.resetHistory();

			expect(device.getStoreValue("meter_power.toGrid.month")).toBe(0);
			expect(device.getStoreValue("meter_power.fromGrid.month")).toBe(0);
			expect(device.getStoreValue("meter_power.produced.month")).toBe(0);
			expect(device.getStoreValue("meter_power.fromgrid.previousmonth")).toBe(0);
		});

		it("should emit updateCapabilities event", async () => {
			const emitSpy = vi.spyOn(device, "emit");

			await device.resetHistory();

			expect(emitSpy).toHaveBeenCalledWith("updateCapabilities");
		});
	});

	describe("updateCapabilities - Financial Calculations", () => {
		it("should calculate daily spending correctly", async () => {
			device._storeValues.set("meter_power.fromGrid.today", 10);
			device._settings.purchaseprice = 0.25;

			await device.updateCapabilities();

			expect(device.getCapabilityValue("spending.day")).toBe(2.5);
		});

		it("should calculate daily savings correctly", async () => {
			device._storeValues.set("meter_power.toGrid.today", 20);
			device._storeValues.set("meter_power.produced.today", 30);
			device._settings.sellprice = 0.1;
			device._settings.purchaseprice = 0.25;

			await device.updateCapabilities();

			// savings = toGrid * sellprice + (produced - toGrid) * purchaseprice
			// savings = 20 * 0.10 + 10 * 0.25 = 2 + 2.5 = 4.5
			expect(device.getCapabilityValue("savings.day")).toBe(4.5);
		});

		it("should calculate self-consumption percentage", async () => {
			device._storeValues.set("meter_power.produced.today", 100);
			device._storeValues.set("meter_power.toGrid.today", 20);

			await device.updateCapabilities();

			// selfconsumption = (produced - toGrid) / produced * 100 = 80%
			expect(device.getCapabilityValue("selfconsumption")).toBe(80);
		});

		it("should calculate monthly self-consumption percentage", async () => {
			device._storeValues.set("meter_power.produced.month", 500);
			device._storeValues.set("meter_power.toGrid.month", 100);

			await device.updateCapabilities();

			// selfconsumption = (500 - 100) / 500 * 100 = 80%
			expect(device.getCapabilityValue("selfconsumption.month")).toBe(80);
		});

		it("should calculate monthly spending (month + today)", async () => {
			device._storeValues.set("meter_power.fromGrid.month", 100);
			device._storeValues.set("meter_power.fromGrid.today", 10);
			device._settings.purchaseprice = 0.25;

			await device.updateCapabilities();

			// spending.month = (100 + 10) * 0.25 = 27.5
			expect(device.getCapabilityValue("spending.month")).toBe(27.5);
		});

		it("should calculate monthly savings correctly", async () => {
			device._storeValues.set("meter_power.toGrid.month", 200);
			device._storeValues.set("meter_power.produced.month", 300);
			device._storeValues.set("meter_power.toGrid.today", 20);
			device._storeValues.set("meter_power.produced.today", 30);
			device._settings.sellprice = 0.1;
			device._settings.purchaseprice = 0.25;

			await device.updateCapabilities();

			// month savings = toGrid.month * sell + (produced.month - toGrid.month) * purchase
			//               = 200 * 0.1 + 100 * 0.25 = 20 + 25 = 45
			// today savings = 20 * 0.1 + 10 * 0.25 = 2 + 2.5 = 4.5
			// total = 49.5
			expect(device.getCapabilityValue("savings.month")).toBe(49.5);
		});

		it("should calculate previous month spending", async () => {
			device._storeValues.set("meter_power.fromGrid.previousmonth", 400);
			device._settings.purchaseprice = 0.25;

			await device.updateCapabilities();

			expect(device.getCapabilityValue("spending.previousmonth")).toBe(100);
		});

		it("should set meter_power values from store", async () => {
			device._storeValues.set("meter_power.toGrid.today", 15);
			device._storeValues.set("meter_power.fromGrid.today", 25);
			device._storeValues.set("meter_power.produced.today", 50);

			await device.updateCapabilities();

			expect(device.getCapabilityValue("meter_power.toGrid")).toBe(15);
			expect(device.getCapabilityValue("meter_power.fromGrid")).toBe(25);
			expect(device.getCapabilityValue("meter_power.produced")).toBe(50);
		});
	});

	describe("updateCapabilities - Edge Cases", () => {
		it("should handle zero production (avoid division by zero)", async () => {
			device._storeValues.set("meter_power.produced.today", 0);
			device._storeValues.set("meter_power.toGrid.today", 0);

			await device.updateCapabilities();

			// Division by zero should result in NaN
			const selfConsumption = device.getCapabilityValue("selfconsumption");
			expect(Number.isNaN(selfConsumption)).toBe(true);
		});

		it("should handle negative values (consumption exceeds production)", async () => {
			device._storeValues.set("meter_power.produced.today", 10);
			device._storeValues.set("meter_power.toGrid.today", 0);
			device._storeValues.set("meter_power.fromGrid.today", 20);

			await device.updateCapabilities();

			expect(device.getCapabilityValue("selfconsumption")).toBe(100);
		});
	});

	describe("getArchiveProduced", () => {
		it("should sum produced energy from inverter archive", async () => {
			const mockResponse = {
				Body: {
					Data: {
						"inverter/1": {
							Data: {
								EnergyReal_WAC_Sum_Produced: {
									Values: {
										86400: 5000,
										172800: 6000,
									},
								},
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const beginDate = new Date(2024, 5, 1);
			const endDate = new Date(2024, 5, 2);

			const result = await device.getArchiveProduced(beginDate, endDate);

			expect(result).toBe(11); // (5000 + 6000) / 1000
		});

		it("should construct correct URL with date format", async () => {
			const mockResponse = {
				Body: {
					Data: {
						"inverter/1": {
							Data: {
								EnergyReal_WAC_Sum_Produced: {
									Values: { 86400: 1000 },
								},
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const beginDate = new Date(2024, 0, 15); // Jan 15, 2024
			const endDate = new Date(2024, 0, 20); // Jan 20, 2024

			await device.getArchiveProduced(beginDate, endDate);

			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("StartDate=15.1.2024"),
			);
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("EndDate=20.1.2024"),
			);
		});

		it("should handle missing data gracefully", async () => {
			const mockResponse = {
				Body: {
					Data: {
						"inverter/1": {
							Data: {},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const beginDate = new Date(2024, 5, 1);
			const endDate = new Date(2024, 5, 2);

			const result = await device.getArchiveProduced(beginDate, endDate);

			expect(result).toBe(0);
		});

		it("should handle multiple inverters", async () => {
			device.inverters = ["1", "2"];

			const mockResponse = {
				Body: {
					Data: {
						"inverter/1": {
							Data: {
								EnergyReal_WAC_Sum_Produced: {
									Values: { 86400: 3000 },
								},
							},
						},
						"inverter/2": {
							Data: {
								EnergyReal_WAC_Sum_Produced: {
									Values: { 86400: 2000 },
								},
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const result = await device.getArchiveProduced(
				new Date(2024, 5, 1),
				new Date(2024, 5, 1),
			);

			expect(result).toBe(5); // (3000 + 2000) / 1000
		});
	});

	describe("getArchiveMeter", () => {
		it("should sum toGrid and fromGrid energy", async () => {
			const mockResponse = {
				Body: {
					Data: {
						0: {
							Data: {
								EnergyReal_WAC_Plus_Absolute: {
									Values: { 86400: 3000 },
								},
								EnergyReal_WAC_Minus_Absolute: {
									Values: { 86400: 5000 },
								},
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const beginDate = new Date(2024, 5, 1);
			const endDate = new Date(2024, 5, 2);

			const result = await device.getArchiveMeter(beginDate, endDate);

			expect(result.fromGridPower).toBe(3);
			expect(result.toGridPower).toBe(5);
		});

		it("should handle missing fromGrid data", async () => {
			const mockResponse = {
				Body: {
					Data: {
						0: {
							Data: {
								EnergyReal_WAC_Minus_Absolute: {
									Values: { 86400: 5000 },
								},
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const result = await device.getArchiveMeter(
				new Date(2024, 5, 1),
				new Date(2024, 5, 2),
			);

			expect(result.fromGridPower).toBe(0);
			expect(result.toGridPower).toBe(5);
		});

		it("should handle missing toGrid data", async () => {
			const mockResponse = {
				Body: {
					Data: {
						0: {
							Data: {
								EnergyReal_WAC_Plus_Absolute: {
									Values: { 86400: 3000 },
								},
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const result = await device.getArchiveMeter(
				new Date(2024, 5, 1),
				new Date(2024, 5, 2),
			);

			expect(result.fromGridPower).toBe(3);
			expect(result.toGridPower).toBe(0);
		});

		it("should split request when date range exceeds 15 days", async () => {
			const mockResponse = {
				Body: {
					Data: {
						0: {
							Data: {
								EnergyReal_WAC_Plus_Absolute: { Values: { 86400: 1000 } },
								EnergyReal_WAC_Minus_Absolute: { Values: { 86400: 2000 } },
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const beginDate = new Date(2024, 5, 1);
			const endDate = new Date(2024, 5, 25); // 24 days span

			const result = await device.getArchiveMeter(beginDate, endDate);

			// Should have made 2 fetch calls due to recursive splitting
			expect(fetch).toHaveBeenCalledTimes(2);
			// Results should be summed: (1 + 1) and (2 + 2)
			expect(result.fromGridPower).toBe(2);
			expect(result.toGridPower).toBe(4);
		});

		it("should not split request when date range is 15 days or less", async () => {
			const mockResponse = {
				Body: {
					Data: {
						0: {
							Data: {
								EnergyReal_WAC_Plus_Absolute: { Values: { 86400: 1000 } },
								EnergyReal_WAC_Minus_Absolute: { Values: { 86400: 2000 } },
							},
						},
					},
				},
			};

			fetch.mockImplementation(createMockFetch(mockResponse));

			const beginDate = new Date(2024, 5, 1);
			const endDate = new Date(2024, 5, 15); // 14 days span

			await device.getArchiveMeter(beginDate, endDate);

			expect(fetch).toHaveBeenCalledTimes(1);
		});
	});

	describe("onInit - Cron Scheduling", () => {
		it("should schedule daily cron for days 2-31", async () => {
			const inverterResponse = {
				Body: { Data: { 1: {} } },
			};
			fetch.mockImplementation(createMockFetch(inverterResponse));

			// Mock pollDevice to prevent infinite loop
			device.pollDevice = vi.fn();

			await device.onInit();

			expect(cron.schedule).toHaveBeenCalledWith(
				"0 0 2-31 * *",
				expect.any(Function),
			);
		});

		it("should schedule monthly cron for 1st day", async () => {
			const inverterResponse = {
				Body: { Data: { 1: {} } },
			};
			fetch.mockImplementation(createMockFetch(inverterResponse));

			device.pollDevice = vi.fn();

			await device.onInit();

			expect(cron.schedule).toHaveBeenCalledWith(
				"0 0 1 * *",
				expect.any(Function),
			);
		});

		it("should register capability listeners for buttons", async () => {
			const inverterResponse = {
				Body: { Data: { 1: {} } },
			};
			fetch.mockImplementation(createMockFetch(inverterResponse));

			device.pollDevice = vi.fn();

			await device.onInit();

			expect(device._capabilityListeners.has("button.recoverHistory")).toBe(
				true,
			);
			expect(device._capabilityListeners.has("button.resetHistory")).toBe(true);
		});

		it("should fetch inverters list on init", async () => {
			const inverterResponse = {
				Body: { Data: { 1: {}, 2: {} } },
			};
			fetch.mockImplementation(createMockFetch(inverterResponse));

			device.pollDevice = vi.fn();

			await device.onInit();

			expect(fetch).toHaveBeenCalledWith(
				"http://192.168.1.100/solar_api/v1/GetInverterInfo.cgi",
			);
			expect(device.inverters).toEqual(["1", "2"]);
		});
	});

	describe("onDeleted - Cleanup", () => {
		it("should stop polling", async () => {
			device.polling = true;
			device.dailycron = { destroy: vi.fn() };
			device.monthlycron = { destroy: vi.fn() };

			await device.onDeleted();

			expect(device.polling).toBe(false);
		});

		it("should destroy cron jobs", async () => {
			device.dailycron = { destroy: vi.fn() };
			device.monthlycron = { destroy: vi.fn() };

			await device.onDeleted();

			expect(device.dailycron.destroy).toHaveBeenCalled();
			expect(device.monthlycron.destroy).toHaveBeenCalled();
		});
	});

	describe("onSettings", () => {
		it("should emit updateCapabilities on settings change", async () => {
			const emitSpy = vi.spyOn(device, "emit");

			await device.onSettings({
				oldSettings: { purchaseprice: 0.2 },
				newSettings: { purchaseprice: 0.25 },
				changedKeys: ["purchaseprice"],
			});

			expect(emitSpy).toHaveBeenCalledWith("updateCapabilities");
		});
	});
});
