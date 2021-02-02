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
		this.biomeOptions = [];

		// Remember which biomes are possible for this region (for most regions it's only 1 biome),
		// and which tier of planet is required (most regions don't have this requirement).
		// Allocate pseudo-region IDs like "regionCode", "regionCode:2", "regionCode:3",
		// where each pseudo-region has only 1 biome.
		var pseudoRegionSuffix = '';
		for ( var minTierBiomes of rawData.biome ) {
			var [ minTier, biomeCodes ] = minTierBiomes;
			for ( var biomeCode of biomeCodes ) {
				if ( this.biomeOptions.length > 0 ) {
					// If this region has only 1 biome (true for absolute majority of regions),
					// then its region ID will never have this suffix.
					pseudoRegionSuffix = ':' + ( this.biomeOptions.length + 1 );
				}

				this.biomeOptions.push( {
					regionCode: this.regionCode + pseudoRegionSuffix,
					biomeCode: biomeCode,
					minTier: minTier
				} );
			}
		}
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
		var oceanLiquid = Query.liquidNamesToItemCodes( this.oceanLiquid || [] ),
			caveLiquid = Query.liquidNamesToItemCodes( this.caveLiquid || [] );

		return this.biomeOptions.map( ( biomeOption ) => {
			return new CargoRow( 'region', {
				id: biomeOption.regionCode,
				biome: biomeOption.biomeCode,
				oceanLiquid: oceanLiquid,
				caveLiquid: caveLiquid
			} );
		} );
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
		if ( this.biomeOptions.length === 1 ) {
			// This region has only 1 biome and is not tier-dependent.
			// This is ~97% of all biomes.
			return [ this.regionCode ].concat( this.subRegion || [] );
		}

		// TODO: find tier-appropriate regions and add them to returned array.
		return [ this.regionCode ].concat( this.subRegion || [] );

	}
}

module.exports = Region;
