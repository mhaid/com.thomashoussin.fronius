import Homey from "homey";
import fetch from "node-fetch";

class FroniusGEN24storage extends Homey.Driver {
	getCheckPath() {
		return "/solar_api/v1/GetPowerFlowRealtimeData.fcgi";
	}

	getFroniusToDevice() {
		return froniusToDevice;
	}

	onPair(session) {
		var devices;
		const checkPath = this.getCheckPath();
		const froniusToDevice = this.getFroniusToDevice();

		session.setHandler("validate", async (data) => {
			console.log("Validate new connection settings");
			const ip = data.host;

			const validationUrl = `http://${ip}${checkPath}`;
			console.log(validationUrl);

			return fetch(validationUrl)
				.then(checkResponseStatus)
				.then((result) => result.json())
				.then((json) =>
					buildDevices(froniusToDevice, json.Body.Data.Inverters, ip),
				)
				.then((list) => {
					devices = list;
					return "ok";
				})
				.catch((error) => {
					console.log(error);
					return error;
				});
		});

		session.setHandler("list_devices", async (_data) => {
			console.log("List devices started...");

			return devices;
		});
	}
}

function froniusToDevice(_json, ip, DeviceId) {
	const device = {
		name: DeviceId,
		settings: {
			ip: ip,
			DeviceId: parseInt(DeviceId, 10),
		},
		data: {
			id: DeviceId,
		},
	};
	console.log(device);
	return device;
}

function checkResponseStatus(res) {
	if (res.ok) {
		return res;
	} else {
		console.log(`Wrong response status : ${res.status} (${res.statusText})`);
		throw new Error(
			`Wrong response status : ${res.status} (${res.statusText})`,
		);
	}
}

function buildDevices(froniusToDevice, json, ip) {
	var devices = [];
	for (var id in json) {
		if (Object.hasOwn(json, id)) {
			devices.push(froniusToDevice(json[id], ip, id));
		}
	}
	return devices;
}

export default FroniusGEN24storage;
