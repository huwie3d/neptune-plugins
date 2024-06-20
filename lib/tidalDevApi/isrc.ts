import { ISRCResponse, TrackData } from "./types/ISRC";
import { requestStream, rejectNotOk, toJson } from "../fetch";
import { getToken } from "./auth";

type ISRCOptions = {
	offset: number;
	limit: number;
};
export const fetchIsrc = async (isrc: string, options?: ISRCOptions) => {
	const { limit, offset } = options ?? { limit: 100, offset: 0 };
	return requestStream(`https://openapi.tidal.com/tracks/byIsrc?isrc=${isrc}&countryCode=US&limit=${limit}&offset=${offset}`, {
		headers: {
			Authorization: `Bearer ${await getToken()}`,
			"Content-Type": "application/vnd.tidal.v1+json",
		},
	})
		.then(rejectNotOk)
		.then(toJson<ISRCResponse>);
};

export async function* fetchIsrcIterable(isrc: string): AsyncIterable<TrackData> {
	let offset = 0;
	const limit = 100;
	while (true) {
		const response = await fetchIsrc(isrc, { limit, offset });
		if (response?.data !== undefined) yield* response.data;
		if (response.data.length < limit) break;
		offset += limit;
	}
}