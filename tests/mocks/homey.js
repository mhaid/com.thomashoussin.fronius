/**
 * Mock Homey.Device class
 */
export class MockDevice {
	constructor() {
		this._capabilities = new Set();
		this._capabilityValues = new Map();
		this._settings = {};
		this._storeValues = new Map();
		this._listeners = new Map();
		this._capabilityListeners = new Map();
		this.polling = false;
	}

	// Capability management
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

	// Settings
	getSetting(key) {
		return this._settings[key];
	}

	getSettings() {
		return this._settings;
	}

	setSettings(settings) {
		this._settings = { ...this._settings, ...settings };
		return Promise.resolve();
	}

	// Store values (for Reporting device)
	getStoreValue(key) {
		return this._storeValues.get(key) ?? 0;
	}

	setStoreValue(key, value) {
		this._storeValues.set(key, value);
		return Promise.resolve();
	}

	// Event emitter
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

	// Logging (no-op in tests)
	log() {}
	error() {}

	// Device info
	getName() {
		return this._settings.name || "Test Device";
	}

	setEnergy() {
		return Promise.resolve();
	}

	// Homey notification
	setWarning() {
		return Promise.resolve();
	}

	unsetWarning() {
		return Promise.resolve();
	}
}

/**
 * Mock Homey.Driver class
 */
export class MockDriver {
	constructor() {
		this._devices = [];
	}

	log() {}
	error() {}
}

/**
 * Mock Homey.App class
 */
export class MockApp {
	log() {}
	error() {}
}

// Export as default Homey module
export default {
	Device: MockDevice,
	Driver: MockDriver,
	App: MockApp,
	__: (key) => key, // i18n mock
};
