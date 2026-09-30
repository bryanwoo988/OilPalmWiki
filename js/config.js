/**
 * The one place to edit when the app gets its public address.
 *
 * APP_URL is what the Info screen's QR code encodes and what its link points
 * at. The QR is generated on the device, so changing this line is the whole
 * job — nothing needs regenerating and nothing is fetched.
 */

export const APP_URL = 'https://bryanwoo988.github.io/OilPalmWiki/';

/** Shown on the Info screen. Bumping CACHE_VERSION in sw.js ships new content. */
export const APP_VERSION = '1.0.0';

export const AUTHOR = 'Bryan Woo';
