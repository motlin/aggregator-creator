import {describe, it} from "vite-plus/test";
import {expect} from "chai";
import {describeGhError} from "../../src/utils/gh-errors.js";

describe("describeGhError", () => {
	it("replaces the gh auth login hint with a single-line explanation", () => {
		const message = [
			"Command failed with exit code 4: gh api repos/motlin/foo/topics",
			"",
			"To get started with GitHub CLI, please run:  gh auth login",
			"Alternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.",
		].join("\n");

		expect(describeGhError(message)).to.deep.equal({
			authenticated: false,
			message: "GitHub CLI is not authenticated. Run `gh auth login` or set the GH_TOKEN environment variable.",
		});
	});

	it("keeps other gh failures unchanged apart from surrounding whitespace", () => {
		expect(describeGhError("  GraphQL: Could not resolve to a Repository\n")).to.deep.equal({
			authenticated: true,
			message: "GraphQL: Could not resolve to a Repository",
		});
	});
});
