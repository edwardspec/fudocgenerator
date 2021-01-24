'use strict';

const { CargoRow, EntityWithPageName, Query, util } = require( '..' );

/**
 * Represents one biome in the BiomeDatabase.
 */
class Biome {
	/**
	 * @param {Object} rawData Structure that describes this biome.
	 */
	constructor( rawData ) {
		Object.assign( this, rawData );

		this.biomeCode = this.name;
		this.displayName = Query.getBiomeName( this.biomeCode ) || this.friendlyName || this.biomeCode;

		if ( this.weather && this.weather[0] ) {
			// Convert strings like "/weather.config:sulphuriccalm" to "sulphuriccalm".
			this.weatherPools = this.weather[0][1].map( ( path ) => path.split( ':' ).pop() );
		}
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'biome-' + this.biomeCode;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Region into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		return new CargoRow( 'biome', {
			id: this.biomeCode,
			name: this.displayName,
			statusEffects: this.statusEffects,
			weatherPools: this.weatherPools
		} );
	}

	/**
	 * Get text of the MediaWiki article about this Biome.
	 *
	 * @return {string}
	 */
	toArticleText() {
		return '{{Automatic infobox biome|' + this.biomeCode + "}}<!-- Please don't delete this line -->\n" +
			'<!-- You can write the text below. -->\n\n\n' +
			'{{All recipes for biome|' + this.biomeCode + '}}' +
			"<!-- Please don't delete this line -->";
	}
}

util.addMixin( Biome, EntityWithPageName );
module.exports = Biome;
