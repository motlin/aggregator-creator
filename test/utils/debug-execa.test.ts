import {describe, it} from "vite-plus/test";
import {expect} from "chai";
import {execa} from "execa";
import {withDebugLogging} from "../../src/utils/debug-execa.js";

describe("withDebugLogging", () => {
	it("logs the command line and its exit code when the command succeeds", async () => {
		const messages: string[] = [];
		const debugExeca = withDebugLogging(execa, (message) => messages.push(message));

		const result = await debugExeca("node", ["-e", 'process.stdout.write("hello")']);

		expect({stdout: result.stdout, messages}).to.deep.equal({
			stdout: "hello",
			messages: [
				'Running: node -e process.stdout.write("hello")',
				'Finished with exit code 0: node -e process.stdout.write("hello")',
			],
		});
	});

	it("logs the failure message and still rejects when the command fails", async () => {
		const messages: string[] = [];
		const debugExeca = withDebugLogging(execa, (message) => messages.push(message));

		let caught: unknown;
		try {
			await debugExeca("node", ["-e", 'process.stderr.write("boom"); process.exit(3)']);
		} catch (error) {
			caught = error;
		}

		expect({failed: caught instanceof Error, messages}).to.deep.equal({
			failed: true,
			messages: [
				'Running: node -e process.stderr.write("boom"); process.exit(3)',
				"Failed: Command failed with exit code 3: node -e 'process.stderr.write(\"boom\"); process.exit(3)'\n\nboom",
			],
		});
	});

	it("logs the failure details when the command fails with reject disabled", async () => {
		const messages: string[] = [];
		const debugExeca = withDebugLogging(execa, (message) => messages.push(message));

		const result = await debugExeca("node", ["-e", 'process.stderr.write("boom"); process.exit(3)'], {
			reject: false,
		});

		expect({exitCode: result.exitCode, messages}).to.deep.equal({
			exitCode: 3,
			messages: [
				'Running: node -e process.stderr.write("boom"); process.exit(3)',
				"Failed: Command failed with exit code 3: node -e 'process.stderr.write(\"boom\"); process.exit(3)'\n\nboom",
			],
		});
	});
});
