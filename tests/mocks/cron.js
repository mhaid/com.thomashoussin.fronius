import { vi } from "vitest";

/**
 * Mock scheduled task
 */
export class MockScheduledTask {
	constructor(expression, callback) {
		this.expression = expression;
		this.callback = callback;
		this.destroyed = false;
		this.running = false;
	}

	start() {
		this.running = true;
	}

	stop() {
		this.running = false;
	}

	destroy() {
		this.destroyed = true;
		this.running = false;
	}

	/**
	 * Manually trigger the scheduled callback (for testing)
	 */
	trigger() {
		if (!this.destroyed) {
			this.callback();
		}
	}
}

// Store all scheduled tasks for test inspection
export const scheduledTasks = [];

/**
 * Mock node-cron module
 */
export default {
	schedule: vi.fn((expression, callback) => {
		const task = new MockScheduledTask(expression, callback);
		scheduledTasks.push(task);
		return task;
	}),

	/**
	 * Clear all scheduled tasks (call in beforeEach)
	 */
	clearTasks: () => {
		scheduledTasks.length = 0;
	},
};
