import { intercept } from "@neptune";
import getPlaybackControl from "@inrixia/lib/getPlaybackControl";
import { MediaItemCache } from "@inrixia/lib/Caches/MediaItemCache";
import { setStyle } from "@inrixia/lib/css/setStyle";
import transparent from "file://transparent.css?minify";
import "./vibrant.native";
import { Tracer } from "@inrixia/lib/trace";
import { settings } from "./Settings";
export { Settings } from "./Settings";

const trace = Tracer("[CoverTheme]");
let prevSong: string | undefined;
let prevCover: string | undefined;
let vars = new Set<string>();

export type Palette = { [key: string]: string };
const paletteCache = new Map<string, Palette>();
async function getPalette(coverId: string) {
	if (paletteCache.has(coverId)) return paletteCache.get(coverId)!;
	const palette = await makePalette(coverId);
	paletteCache.set(coverId, palette);
	return palette;
}

function makePalette(coverId: string): Promise<Palette> {
	return window.electron.ipcRenderer.invoke("VIBRANT_GET_PALETTE", coverId);
}

async function updateBackground(productId: string) {
	if (prevSong === productId) return;
	prevSong = productId;

	const mediaItem = await MediaItemCache.ensure(productId);
	if (!mediaItem || !mediaItem.album?.cover) return;

	if (prevCover === mediaItem.album.cover) return;
	prevCover = mediaItem.album.cover;

	const palette = await getPalette(mediaItem.album.cover);
	if (palette === undefined) return;

	for (const [colorName, rgb] of Object.entries(palette)) {
		const variableName = `--cover-${colorName}`;
		vars.add(variableName);
		document.documentElement.style.setProperty(variableName, rgb ?? null);
	}
}

const onCatch = trace.msg.err.withContext("Failed to update background");

function onTransition([track]: any[]) {
	const id = (track.mediaProduct as { productId?: string })?.productId;
	if (id) updateBackground(id).catch(onCatch);
}

const unloadPrefill = intercept(
	"playbackControls/PREFILL_MEDIA_PRODUCT_TRANSITION",
	onTransition
);

const unloadTransition = intercept(
	"playbackControls/MEDIA_PRODUCT_TRANSITION",
	onTransition
);

const style = setStyle();
export function updateStyle() {
	style.css = settings.transparentTheme ? transparent : "";
}

updateStyle();
const { playbackContext } = getPlaybackControl();
if (playbackContext)
	updateBackground(playbackContext.actualProductId).catch(onCatch);

export const onUnload = () => {
	unloadPrefill();
	unloadTransition();
	style.remove();
	vars.forEach((variable) =>
		document.documentElement.style.removeProperty(variable)
	);
	prevSong = undefined;
	prevCover = undefined;
};
