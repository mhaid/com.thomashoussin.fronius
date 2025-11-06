import Homey from "homey";
import fetch from "node-fetch";

const checkPath = "/solar_api/v1/GetPowerFlowRealtimeData.fcgi";

class FroniusPowerFlow extends Homey.Driver {
	/**
	 * onInit is called when the driver is initialized.
	 */
	async onInit() {
		this.log("FroniusPowerFlow has been initialized");
	}

	onPair(session) {
		session.setHandler("validate", async (data) => {
			console.log("Validate new connection settings");
			const ip = data.host;

			const validationUrl = `http://${ip}${checkPath}`;
			console.log(validationUrl);

			return fetch(validationUrl)
				.then(checkResponseStatus)
				.then((_res) => {
					return "ok";
				})
				.catch((error) => {
					return error;
				});
		});
	}
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

export default FroniusPowerFlow;
