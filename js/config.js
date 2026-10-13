/**
 * The one place to edit when the app gets its public address.
 *
 * APP_URL is what the Info screen's QR code encodes and what its link points
 * at. The QR is generated on the device, so changing this line is the whole
 * job — nothing needs regenerating and nothing is fetched.
 */

export const APP_URL = 'https://bryanwoo988.github.io/OilPalmWiki/';

import { RELEASES } from './releases.js';

/** Shown on the Info screen: the newest entry in releases.js. */
export const APP_VERSION = RELEASES[0].v;

export const AUTHOR = 'Bryan Woo';
