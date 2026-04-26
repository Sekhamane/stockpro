import server from "../dist/server/server.js";

export const config = {
	runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
	return server.fetch(request);
}