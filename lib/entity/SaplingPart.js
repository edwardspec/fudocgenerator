'use strict';

const { RecipeSide, EntityWithPageName, util } = require( '..' );
/**
 * Represents one stem OR one foliage (part of the modular trees) in the SaplingPartDatabase.
 */
class SaplingPart {
	/**
	 * @param {Object} rawData Structure that describes this stem/foliage.
	 * @param {boolean} isFoliage True for foliage, false for stem.
	 * @param {string|undefined} friendlyName Human-readable prefix/suffix of sapling (optional).
	 */
	constructor( rawData, isFoliage, friendlyName ) {
		const prefix = ( isFoliage ? 'Foliage' : 'Stem' );

		this.isFoliage = isFoliage;
		this.name = rawData.name;

		this.displayName = prefix + ': ' + this.name;
		if ( friendlyName && friendlyName !== 'Unknown' ) {
			this.displayName += ' (' + friendlyName + ')';
		}

		this.drops = RecipeSide.newFromCraftingInput(
			rawData.dropConfig ? rawData.dropConfig.drops[0] : []
		);

		if ( this.drops.isEmpty() ) {
			this.drops.addComment( "''(drops nothing)''" );
		}
	}

	/**
	 * Get text of the MediaWiki article about this TreasurePool.
	 *
	 * @return {string}
	 */
	toArticleText() {
		return '{{All recipes for ' + ( this.isFoliage ? 'foliage' : 'stem' ) + '|' + this.name + '}}';
	}
}

util.addMixin( SaplingPart, EntityWithPageName );
module.exports = SaplingPart;
