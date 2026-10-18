import {describe, it} from "vite-plus/test";
import {Readable} from "node:stream";
import {expect} from "chai";
import {readStdin} from "../../src/utils/read-stdin.js";

describe("readStdin", () => {
	it("concatenates every chunk of the stream into one string", async () => {
		const stream = Readable.from(['{"name": ', '"repo", ', '"owner": {"login": "user"}}']);

		expect(await readStdin(stream)).to.equal('{"name": "repo", "owner": {"login": "user"}}');
	});

	it("decodes UTF-8 characters split across buffer chunks", async () => {
		const bytes = Buffer.from("café\n");
		const stream = Readable.from([bytes.subarray(0, 4), bytes.subarray(4)]);

		expect(await readStdin(stream)).to.equal("café\n");
	});

	it("returns an empty string for an empty stream", async () => {
		expect(await readStdin(Readable.from([]))).to.equal("");
	});
});
