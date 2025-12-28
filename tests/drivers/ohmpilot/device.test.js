import { beforeEach, describe, expect, it } from "vitest";
import OhmPilotDevice from "../../../drivers/ohmpilot/device.js";

/**
 * Test wrapper for OhmPilotDevice
 */
class TestOhmPilotDevice extends OhmPilotDevice {
	constructor() {
		super();
		this._capabilities = new Set([
			"meter_power",
			"measure_power",
			"measure_temperature",
			"ohmpilotstate",
		]);
		this._capabilityValues = new Map();
		this._settings = {
			ip: "192.168.1.100",
			DeviceId: 0,
			polling_interval: 300,
		};
		this._listeners = new Map();
		this.polling = false;
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
		return "Test OhmPilot";
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
}

describe("OhmPilotDevice", () => {
	let device;

	beforeEach(() => {
		device = new TestOhmPilotDevice();
	});

	describe("getUpdatePath", () => {
		it("should return correct API path", () => {
			expect(device.getUpdatePath()).toBe(
				"/solar_api/v1/GetOhmPilotRealtimeData.cgi?",
			);
		});
	});

	describe("updateValues - state code mapping", () => {
		const stateTestCases = [
			{ code: 0, expected: "up", description: "up and running" },
			{ code: 1, expected: "keepmin", description: "keep minimum temperature" },
			{ code: 2, expected: "legionella", description: "legionella protection" },
			{ code: 3, expected: "critical", description: "critical fault" },
			{ code: 4, expected: "fault", description: "fault" },
			{ code: 5, expected: "boost", description: "boost mode" },
		];

		for (const { code, expected, description } of stateTestCases) {
			it(`should map CodeOfState ${code} (${description}) to "${expected}"`, () => {
				const data = {
					CodeOfState: code,
					EnergyReal_WAC_Sum_Consumed: 15000,
					PowerReal_PAC_Sum: 500,
					Temperature_Channel_1: 45,
				};

				device.updateValues(data);

				expect(device.getCapabilityValue("ohmpilotstate")).toBe(expected);
			});
		}

		it('should map CodeOfState 6 to "unknown"', () => {
			const data = {
				CodeOfState: 6,
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 500,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("ohmpilotstate")).toBe("unknown");
		});

		it('should map unknown CodeOfState to "unknown"', () => {
			const data = {
				CodeOfState: 99,
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 500,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("ohmpilotstate")).toBe("unknown");
		});

		it('should default to "unknown" when CodeOfState is undefined', () => {
			const data = {
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 500,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("ohmpilotstate")).toBe("unknown");
		});
	});

	describe("updateValues - measurements", () => {
		it("should convert energy from Wh to kWh", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 500,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(15);
		});

		it("should set power value directly", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 2500,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBe(2500);
		});

		it("should set temperature value directly", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 500,
				Temperature_Channel_1: 62.5,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_temperature")).toBe(62.5);
		});
	});

	describe("updateValues - undefined handling", () => {
		it("should default to 0 for undefined energy", () => {
			const data = {
				CodeOfState: 0,
				PowerReal_PAC_Sum: 500,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
		});

		it("should default to 0 for undefined power", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 15000,
				Temperature_Channel_1: 45,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_power")).toBe(0);
		});

		it("should default to 0 for undefined temperature", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 15000,
				PowerReal_PAC_Sum: 500,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("measure_temperature")).toBe(0);
		});

		it("should handle all undefined values", () => {
			const data = {};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
			expect(device.getCapabilityValue("measure_temperature")).toBe(0);
			expect(device.getCapabilityValue("ohmpilotstate")).toBe("unknown");
		});
	});

	describe("updateValues - edge cases", () => {
		it("should handle zero values", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 0,
				PowerReal_PAC_Sum: 0,
				Temperature_Channel_1: 0,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(0);
			expect(device.getCapabilityValue("measure_power")).toBe(0);
			expect(device.getCapabilityValue("measure_temperature")).toBe(0);
			expect(device.getCapabilityValue("ohmpilotstate")).toBe("up");
		});

		it("should handle large energy values", () => {
			const data = {
				CodeOfState: 0,
				EnergyReal_WAC_Sum_Consumed: 1000000,
				PowerReal_PAC_Sum: 3000,
				Temperature_Channel_1: 80,
			};

			device.updateValues(data);

			expect(device.getCapabilityValue("meter_power")).toBe(1000);
		});
	});
});
