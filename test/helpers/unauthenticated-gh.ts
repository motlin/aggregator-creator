import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

const AUTH_VARIABLES = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN", "GH_CONFIG_DIR"];

/**
 * Point gh at an empty config directory with no token so every gh call fails as unauthenticated.
 * Returns a function that restores the original environment.
 */
export async function useUnauthenticatedGh(): Promise<() => Promise<void>> {
	const saved = Object.fromEntries(AUTH_VARIABLES.map((name) => [name, process.env[name]]));
	const configDir = await fs.mkdtemp(path.join(os.tmpdir(), "gh-unauthenticated-"));

	for (const name of AUTH_VARIABLES) {
		delete process.env[name];
	}
	process.env.GH_CONFIG_DIR = configDir;

	return async () => {
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
		await fs.remove(configDir);
	};
}
