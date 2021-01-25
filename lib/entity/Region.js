'use strict';

const { CargoRow, Query } = require( '..' );

/**
 * Represents one planetary region in the RegionDatabase.
 */
class Region {
	/**
	 * @param {string} code Machine-readable ID of this region, e.g. "tidewaterfloor".
	 * @param {Object} rawData Structure from terrestial_worlds.config that describes this region.
	 */
	constructor( code, rawData ) {
		Object.assign( this, rawData );

		this.regionCode = code;
		this.biome = rawData.biome[0][1][0];
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'region-' + this.regionCode;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Region into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		return new CargoRow( 'region', {
			id: this.regionCode,
			biome: this.biome,
			oceanLiquid: Query.liquidNamesToItemCodes( this.oceanLiquid || [] ),
			caveLiquid: Query.liquidNamesToItemCodes( this.caveLiquid || [] )
		} );
	}
}

module.exports = Region;
