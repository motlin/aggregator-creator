import {describe, it, beforeEach, afterEach} from "vite-plus/test";
import {expect} from "chai";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {restore, spy, stub} from "sinon";
import {validateMavenRepo} from "../../src/utils/maven-validation.js";
import {createMockResult} from "./mock-result.js";

type ExecaParam = Parameters<typeof validateMavenRepo>[1];

describe("validateMavenRepo", () => {
	let tempDir: string;
	let execaStub: ReturnType<typeof stub>;
	let logger: {log: ReturnType<typeof spy>; warn: ReturnType<typeof spy>};

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "maven-validation-test-"));
		execaStub = stub();
		logger = {log: spy(), warn: spy()};
	});

	afterEach(async () => {
		restore();
		await fs.remove(tempDir);
	});

	it("reports a missing path without running Maven", async () => {
		const missing = path.join(tempDir, "missing");

		const result = await validateMavenRepo(missing, execaStub, logger);

		expect({result, execaCalls: execaStub.callCount}).to.deep.equal({
			result: {path: missing, hasPom: false, valid: false, error: "Path does not exist"},
			execaCalls: 0,
		});
	});

	it("reports a path that is a file rather than a directory", async () => {
		const filePath = path.join(tempDir, "file.txt");
		await fs.writeFile(filePath, "not a directory");

		const result = await validateMavenRepo(filePath, execaStub, logger);

		expect({result, execaCalls: execaStub.callCount}).to.deep.equal({
			result: {path: filePath, hasPom: false, valid: false, error: "Path is not a directory"},
			execaCalls: 0,
		});
	});

	it("reports a directory without pom.xml as not Maven, without an error", async () => {
		const result = await validateMavenRepo(tempDir, execaStub, logger);

		expect({result, execaCalls: execaStub.callCount, logs: logger.log.args}).to.deep.equal({
			result: {path: tempDir, hasPom: false, valid: false, error: null},
			execaCalls: 0,
			logs: [[`│  │  │ No pom.xml found at: ${path.join(tempDir, "pom.xml")}`]],
		});
	});

	it("reports a valid Maven repository when help:effective-pom succeeds", async () => {
		const pomPath = path.join(tempDir, "pom.xml");
		await fs.writeFile(pomPath, "<project/>");
		execaStub.resolves(createMockResult());

		const result = await validateMavenRepo(tempDir, execaStub, logger);

		expect({result, execaArgs: execaStub.args}).to.deep.equal({
			result: {path: tempDir, hasPom: true, valid: true, error: null},
			execaArgs: [["mvn", ["help:effective-pom", "--quiet", "--file", pomPath]]],
		});
	});

	it("reports Maven validation failure when help:effective-pom fails", async () => {
		await fs.writeFile(path.join(tempDir, "pom.xml"), "<project>");
		execaStub.rejects(new Error("Command failed with exit code 1: mvn help:effective-pom"));

		const result = await validateMavenRepo(tempDir, execaStub, logger);

		expect({result, warnings: logger.warn.args}).to.deep.equal({
			result: {path: tempDir, hasPom: true, valid: false, error: "Maven validation failed"},
			warnings: [],
		});
	});

	it("reports a missing mvn binary and warns", async () => {
		await fs.writeFile(path.join(tempDir, "pom.xml"), "<project/>");
		execaStub.rejects(new Error("spawn mvn ENOENT"));

		const result = await validateMavenRepo(tempDir, execaStub, logger);

		expect({result, warnings: logger.warn.args}).to.deep.equal({
			result: {path: tempDir, hasPom: true, valid: false, error: "Maven (mvn) command not found"},
			warnings: [["│  │  │ Maven (mvn) command not found. Please install Maven."]],
		});
	});

	it("resolves relative paths to absolute paths", async () => {
		const relative = path.relative(process.cwd(), tempDir);

		const result = await validateMavenRepo(relative, execaStub);

		expect(result).to.deep.equal({path: tempDir, hasPom: false, valid: false, error: null});
	});
});
