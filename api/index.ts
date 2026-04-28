import type { IncomingMessage, ServerResponse } from "node:http";
import server from "../dist/server/server.js";

function toHeaders(input: IncomingMessage["headers"]): Headers {
	const headers = new Headers();
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === "undefined") continue;
		if (Array.isArray(value)) {
			for (const item of value) headers.append(key, item);
			continue;
		}
		headers.set(key, value);
	}
	return headers;
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
	if (req.method === "GET" || req.method === "HEAD") return undefined;
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
	}
	if (chunks.length === 0) return undefined;
	return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
	const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host ?? "localhost";
	const url = new URL(req.url ?? "/", `${protocol}://${host}`);
	const body = await readBody(req);

	const request = new Request(url, {
		method: req.method ?? "GET",
		headers: toHeaders(req.headers),
		body,
		duplex: "half",
	});

	const response = await server.fetch(request);

	res.statusCode = response.status;
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});

	const buffer = Buffer.from(await response.arrayBuffer());
	res.end(buffer);
}