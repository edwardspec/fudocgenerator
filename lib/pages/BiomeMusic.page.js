'use strict';

const { util } = require( '..' );

/**
 * Generator for a bot-updated human-readable list of all music tracks (for every biome).
 */
class BiomeMusicPage {
	getTitle() {
		return 'Template:List of biome music';
	}

	getText() {
		return 'TODO';
	}
}

module.exports = new BiomeMusicPage();
