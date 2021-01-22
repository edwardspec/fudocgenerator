'use strict';

const { CargoRow } = require( '..' );

/**
 * Represents one biome in the BiomeDatabase.
 */
class Biome {
	/**
	 * @param {Object} rawData Structure that describes this biome.
	 */
	constructor( rawData ) {
		Object.assign( this, rawData );

		this.id = this.name;
		this.displayName = this.friendlyName;

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
		return 'biome-' + this.id;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Region into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		return new CargoRow( 'biome', {
			id: this.id,
			name: this.displayName,
			mainBlock: this.mainBlock,
			subBlocks: this.subBlocks,
			weatherPools: this.weatherPools
		} );
	}
}

module.exports = Biome;
