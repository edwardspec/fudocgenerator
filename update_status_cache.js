/**
 * Query the MediaWiki API and update the cache of "which pages exist?".
 * This will later be used by generate.js to create "onlynew" files for Pywikibot.
 *
 * Note that this script is never called automatically.
 * When to run it is exclusively up to the user.
 *
 * Usage: node update_status_cache.js
 */

'use strict';

( async () => {

	const WikiStatusCache = require( './lib/WikiStatusCache' );
	await WikiStatusCache.updateCache();

} )();
