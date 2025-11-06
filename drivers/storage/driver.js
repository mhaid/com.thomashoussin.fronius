import FroniusDriver from "../../lib/driver.js";

class StorageDriver extends FroniusDriver {
	getCheckPath() {
		return "/solar_api/v1/GetStorageRealtimeData.cgi?Scope=System";
	}

	getFroniusToDevice() {
		return froniusToDevice;
	}
}

function froniusToDevice(json, ip, DeviceId) {
	const device = {
		name: `${json.Controller.Details.Model}-${json.Controller.Details.Serial}`,
		settings: {
			ip: ip,
			DeviceId: parseInt(DeviceId, 10),
		},
		data: {
			id: json.Controller.Details.Serial,
		},
	};
	console.log(device);
	return device;
}

export default StorageDriver;
