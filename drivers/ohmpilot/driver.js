import FroniusDriver from "../../lib/driver.js";

class OhmpilotDriver extends FroniusDriver {
	getCheckPath() {
		return "/solar_api/v1/GetOhmPilotRealtimeData.cgi?Scope=System";
	}

	getFroniusToDevice() {
		return froniusToDevice;
	}
}

function froniusToDevice(json, ip, DeviceId) {
	const device = {
		name: `${json.Details.Model}-${json.Details.Serial}`,
		settings: {
			ip: ip,
			DeviceId: parseInt(DeviceId, 10),
		},
		data: {
			id: json.Details.Serial,
		},
	};
	console.log(device);
	return device;
}

export default OhmpilotDriver;
