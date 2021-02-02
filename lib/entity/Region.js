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
		delete this.biome;

		this.regionCode = code;
		this.biomeOptions = rawData.biome;
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
	 * @return {CargoRow[]}
	 */
	toCargoDatabase() {
		var rows = [];
		var pseudoRegionSuffix = '';

		for ( var biomeOption of this.biomeOptions ) {
			for ( var biomeCode of biomeOption[1] ) {
				if ( rows.length > 0 ) {
					// For regions that have 2+ possible biomes, create multiple rows in "region" table,
					// using "regionCode", "regionCode:2", "regionCode:3", etc. as values of their region.id field.
					// Most regions have only 1 biome, so this won't be needed for them.
					pseudoRegionSuffix = ':' + ( rows.length + 1 );
				}

				rows.push( new CargoRow( 'region', {
					id: this.regionCode + pseudoRegionSuffix,
					biome: biomeCode,
					oceanLiquid: Query.liquidNamesToItemCodes( this.oceanLiquid || [] ),
					caveLiquid: Query.liquidNamesToItemCodes( this.caveLiquid || [] )
				} ) );
			}
		}

		return rows;
	}

	/**
	 * Returns an array of region IDs that should be written into primaryRegion/secondaryRegions fields
	 * of the "planet" database.
	 * This includes: 1) ID of this region, 2) IDs of all subregions (if any),
	 * 3) IDs of pseudo-region rows that were created in toCargoDatabase() for situations when a region
	 * has 2+ biomes and/or is tier-dependent (e.g. vanilla region "core" is like that).
	 *
	 * @param {float} minTier Minimum tier (threat level) of the planet type that has this Region.
	 * @param {float} maxTier Maximum tier of the planet type that has this Region.
	 * @return {string[]}
	 */
	getCodesForTier( minTier, maxTier ) {
		if ( this.biomeOptions.length === 1 && this.biomeOptions[0][1].length === 1 ) {
			// This region has only 1 biome and is not tier-dependent.
			// This is ~97% of all biomes.
			return [ this.regionCode ].concat( this.subRegion || [] );
		}

		// TODO: find tier-appropriate regions and add them to returned array.
		return [ this.regionCode ].concat( this.subRegion || [] );

	}
}

module.exports = Region;
