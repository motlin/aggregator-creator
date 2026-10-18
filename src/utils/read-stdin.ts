/**
 * Read all of a stream (stdin by default) into one string, decoding UTF-8 across chunk boundaries.
 */
export async function readStdin(stream: AsyncIterable<Buffer | string> = process.stdin): Promise<string> {
	const decoder = new TextDecoder();
	let input = "";
	for await (const chunk of stream) {
		input += typeof chunk === "string" ? chunk : decoder.decode(chunk, {stream: true});
	}

	return input + decoder.decode();
}
