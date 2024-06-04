'use strict';

const { AssetDatabase } = require( '..' );

/**
 * Creates the page [[Template:Version of FU when bot was last called]].
 */
class LatestVersion {
	getTitle() {
		return 'Template:Version of FU when bot was last called';
	}

	getText() {
		// Expected format: "6.4.1".
		return AssetDatabase.getData( '_FUversioning.config' ).version.replace( /Version/, '' ).trim();
	}
}

module.exports = new LatestVersion();
