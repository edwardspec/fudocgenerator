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
		let pseudoRegionSuffix = '';
		for ( const minTierBiomes of rawData.biome ) {
			const [ minTier, biomeCodes ] = minTierBiomes;
			for ( const biomeCode of biomeCodes ) {
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

		// Additionally calculate maxTier for every biomeOption,
		// which is equal to minTier of the previous biomeOption that had different minTier.
		for ( let i = 0; i < this.biomeOptions.length - 1; i++ ) {
			const minTier = this.biomeOptions[i].minTier,
				maxTier = this.biomeOptions[i + 1].minTier;

			if ( minTier !== maxTier ) {
				for ( let j = i; j >= 0; j-- ) {
					if ( this.biomeOptions[j].minTier !== minTier ) {
						break;
					}

					this.biomeOptions[j].maxTierNotIncluding = maxTier;
				}
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
		const oceanLiquid = Query.liquidNamesToItemCodes( this.oceanLiquid || [] ),
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
		const seenBiomes = new Set(); // { biomeCode1, biomeCode2, ... }

		const codes = [];
		for ( const biomeOption of this.biomeOptions ) {
			if ( biomeOption.minTier > maxTier ) {
				// Planet is too low-tier to have this option.
				continue;
			}

			if ( biomeOption.maxTierNotIncluding && biomeOption.maxTierNotIncluding <= minTier ) {
				// Planet is too high-tier to have this option.
				continue;
			}

			if ( seenBiomes.has( biomeOption.biomeCode ) ) {
				// No need to add: we already added a region with exactly the same biome.
				// For example, "underground" region in vanilla has such duplicates.
				continue;
			}

			codes.push( biomeOption.regionCode );
			seenBiomes.add( biomeOption.biomeCode );
		}

		return codes.concat( this.subRegion || [] );
	}

	/**
	 * Get all possible variants of dayLightColor in this Region.
	 *
	 * @return {LightColor[]}
	 */
	getDayLightColors() {
		return this.biomeOptions.map( ( biomeOption ) => {
			return Query.findBiome( biomeOption.biomeCode ).getDayLightColors();
		} ).flat();
	}

	/**
	 * Get all possible variants of average Wind Power in this Region.
	 *
	 * @return {int}
	 */
	getWindPowerOptions() {
		return this.biomeOptions.map( ( biomeOption ) => {
			return Query.findBiome( biomeOption.biomeCode ).getWindPowerOptions();
		} ).flat();
	}
}

module.exports = Region;
