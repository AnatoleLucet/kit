import { Readable } from 'stream';

/** @type {import('@sveltejs/kit/node').GetRawBody} */
export function getRawBody(req) {
	return new Promise((fulfil, reject) => {
		const h = req.headers;

		if (!h['content-type']) {
			return fulfil(null);
		}

		req.on('error', reject);

		const length = Number(h['content-length']);

		// https://github.com/jshttp/type-is/blob/c1f4388c71c8a01f79934e68f630ca4a15fffcd6/index.js#L81-L95
		if (isNaN(length) && h['transfer-encoding'] == null) {
			return fulfil(null);
		}

		let data = new Uint8Array(length || 0);

		if (length > 0) {
			let offset = 0;
			req.on('data', (chunk) => {
				const new_len = offset + Buffer.byteLength(chunk);

				if (new_len > length) {
					return reject({
						status: 413,
						reason: 'Exceeded "Content-Length" limit'
					});
				}

				data.set(chunk, offset);
				offset = new_len;
			});
		} else {
			req.on('data', (chunk) => {
				const new_data = new Uint8Array(data.length + chunk.length);
				new_data.set(data, 0);
				new_data.set(chunk, data.length);
				data = new_data;
			});
		}

		req.on('end', () => {
			fulfil(data);
		});
	});
}

/** @type {import('@sveltejs/kit/node').GetRequest} */
export async function getRequest(base, req) {
	return new Request(base + req.url, {
		method: req.method,
		headers: /** @type {Record<string, string>} */ (req.headers),
		body: await getRawBody(req)
	});
}

/** @type {import('@sveltejs/kit/node').SetResponse} */
export async function setResponse(res, response) {
	res.writeHead(response.status, Object.fromEntries(response.headers));

	if (response.body instanceof Readable) {
		response.body.pipe(res);
	} else {
		if (response.body) {
			res.write(await response.arrayBuffer());
		}

		res.end();
	}
}
