/**
 * Methods to search the non-persistent, in-memory database of "all known recipes".
 * Usage: first you add recipes via add(). Then you use makeSearchIndex().
 */

const ItemDatabase = require( './ItemDatabase' );

class CraftingStationDatabase {
	constructor() {
		this.loaded = false;

		// Array of all known crafting stations, e.g. [ "wiringstation", "craftinganvil" ].
		this.knownStations = [];

		// Map of crafting recipe group (e.g. "chemlab2" ) to the array of crafting stations,
		// e.g. { "somegroup": [ "station1", "station2", "station3" ] }
		this.knownStationsForGroup = [];
	}

	/**
	 * Scan the ItemDatabase and find all crafting stations.
	 */
	load() {
		ItemDatabase.forEach( ( itemCode, data ) => {
			if ( !data.objectName ) {
				// All crafting stations are interactive objects. Skip the regular items.
				return;
			}

			if ( itemCode == 'medievalworkstation' ) {
				// Purposely skip Medieval Workstation.
				// It crafts a lot of things from other Tier 1 stations do,
				// and we want to show those stations instead.
				return;
			}

			// TODO: should we exclude specialized crafting stations, like Rustic Skath Forge or Crystal Workbench?

			if ( data.interactData ) {
				var groups = data.interactData.filter;
				if ( groups ) {
					// Remember this crafting station.
					this.add( itemCode, groups );
				}
			}

			// Handle stations like "craftingfurnace" or "prototype",
			// which only have have "filter" in their upgradeStages array.
			if ( data.upgradeStages ) {
				console.log( "found upgradeable station: " + itemCode );
				for ( var stageInfo of data.upgradeStages ) {
					if ( stageInfo.interactData ) {
						var groups = stageInfo.interactData.filter;
						if ( groups ) {
							// Remember this upgrade of this crafting station.
							// TODO: should probably remember the name of upgraded station, not itemCode (which is shared for all upgrades).
							this.add( itemCode, groups );
						}
					}
				}
			}
		} );

		// TODO: sort arrays in knownStationsForGroup in such a way that the low-tech stations
		// would be first, and high-tech stations last.

		this.loaded = true;
	}

	/**
	 * Remember this station's groups for use in findByGroups().
	 * @param {string} itemCode
	 * @param {string[]} groups
	 */
	add( itemCode, groups ) {
		this.knownStations.push( itemCode );

		for ( var group of groups ) {
			if ( !this.knownStationsForGroup[group] ) {
				this.knownStationsForGroup[group] = [];
			}

			this.knownStationsForGroup[group].push( itemCode );
		}
	}

	/**
	 * Returns the name of crafting station that can craft the CraftingRecipe with these groups.
	 * @param string {groups} E.g. [ "chemlab2", "liquids", "all" ]
	 * @return {string|false}
	 */
	findByGroups( groups ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var group of groups ) {
			if ( this.knownStationsForGroup[group] ) {
				// Found a station that can craft this.
				var itemCode = this.knownStationsForGroup[group][0];
				return ItemDatabase.getDisplayName( itemCode );
			}
		}

		// Haven't found a station that can craft this.
		return false;
	}
}

module.exports = new CraftingStationDatabase();
