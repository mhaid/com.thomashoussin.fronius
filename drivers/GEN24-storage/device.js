import fetch from "node-fetch";
import FroniusDevice from "../../lib/device.js";

class GEN24storage extends FroniusDevice {
	async onInit() {
		this.log("Device GEN24storage has been initialized");

		// Enable device polling
		this.polling = true;
		this.addListener("poll", this.pollDevice);
		this.emit("poll");

		//this driver is now deprecated
		//registering notification
		this.homey.notifications
			.createNotification({
				excerpt: `The GEN24 storage driver is now deprecated. Update your Fronius firmware and use the storage device.`,
			})
			.catch((error) => {
				this.error(`Error sending notification: ${error.message}`);
			});

		console.log(
			`The GEN24 storage driver is now deprecated. Update your Fronius driver and use the storage device.`,
		);
	}

	updateFroniusDevice() {
		const settings = this.getSettings();

		const updatePath = "/solar_api/v1/GetPowerFlowRealtimeData.fcgi";
		const updateUrl = `http://${settings.ip}${updatePath}`;
		console.log(updateUrl);

		fetch(updateUrl)
			.then(FroniusDevice.checkResponseStatus)
			.then((result) => result.json())
			.then((json) =>
				this.updateValues(json.Body.Data.Inverters[settings.DeviceId]),
			)
			.catch((_error) => {
				console.log(
					`Error when updating GEN24 storage ${this.getName()} on ${updateUrl}`,
				);
			});
	}

	updateValues(data) {
		this.setCapabilityValue(
			"measure_battery",
			typeof data.SOC === "undefined" || data.P == null ? 0 : data.SOC,
		);
		this.setCapabilityValue(
			"battery_mode",
			typeof data.Battery_Mode === "undefined" || data.P == null
				? "Unknown"
				: data.Battery_Mode,
		);
	}
}

export default GEN24storage;
