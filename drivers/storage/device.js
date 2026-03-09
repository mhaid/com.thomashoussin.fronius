import FroniusDevice from "../../lib/device.js";

class StorageDevice extends FroniusDevice {
	/**
	 * onInit is called when the device is initialized.
	 */
	async onInit() {
		this.log("Device has been initialized");

		if (!this.hasCapability("battery_charging_state")) {
			console.log(
				`Adding capability battery_charging_state to device ${this.getName()}`,
			);
			this.addCapability("battery_charging_state");
		}

		// Remove deprecated meter_power capability
		if (this.hasCapability("meter_power")) {
			console.log(
				`Removing deprecated capability meter_power from device ${this.getName()}`,
			);
			this.removeCapability("meter_power");
		}

		// Enable device polling
		this.polling = true;
		this.addListener("poll", this.pollDevice);
		this.emit("poll");
	}

	getUpdatePath() {
		return "/solar_api/v1/GetStorageRealtimeData.cgi?";
	}

	updateValues(data) {
		const voltage =
			typeof data.Controller.Voltage_DC === "undefined"
				? 0
				: data.Controller.Voltage_DC;
		const current =
			typeof data.Controller.Current_DC === "undefined"
				? 0
				: data.Controller.Current_DC;

		//Current maximum capacity - removed this is not what's expected in meter / homey app
		//this.setCapabilityValue('meter_power', typeof data.Controller.Capacity_Maximum == 'undefined' ? 0 : data.Controller.Capacity_Maximum / 1000);

		//Voltage DC
		this.setCapabilityValue("measure_voltage", voltage);
		// Charging state
		if (this.hasCapability("battery_charging_state")) {
			this.setCapabilityValue(
				"battery_charging_state",
				current > 0 ? "charging" : current < 0 ? "discharging" : "idle",
			).catch(
				this.error,
			);
		}
		//Voltage Current
		this.setCapabilityValue("measure_current", current);
		//temp ; default to 0
		this.setCapabilityValue(
			"measure_temperature",
			typeof data.Controller.Temperature_Cell === "undefined"
				? 0
				: data.Controller.Temperature_Cell,
		);
		//% of charge
		this.setCapabilityValue(
			"measure_battery",
			typeof data.Controller.StateOfCharge_Relative === "undefined"
				? 0
				: data.Controller.StateOfCharge_Relative,
		);
		//power approximation
		this.setCapabilityValue("measure_power", voltage * current);
	}
}

export default StorageDevice;
