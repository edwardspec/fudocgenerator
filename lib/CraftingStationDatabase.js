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
			if ( !data.objectName || !data.interactData ) {
				// All crafting stations are interactive objects. Skip the regular items.
				return;
			}

			if ( itemCode == 'medievalworkstation' ) {
				// Purposely skip Medieval Workstation.
				// It crafts a lot of things from other Tier 1 stations do,
				// and we want to show those stations instead.
			}

			var groups = data.interactData.filter;
			if ( !groups ) {
				// This object doesn't craft anything.
				return;
			}

			// TODO: there are also stations like "craftingfurnace" or "prototype" that have "filter" in their upgradeStages array,
			// we need to support them too.

			// This is a crafting station. Remember that.
			this.knownStations.push( itemCode );

			// Remember this station's groups for use in findByGroups().
			for ( var group of groups ) {
				if ( !this.knownStationsForGroup[group] ) {
					this.knownStationsForGroup[group] = [];
				}

				this.knownStationsForGroup[group].push( itemCode );
			}
		} );

		// TODO: sort arrays in knownStationsForGroup in such a way that the low-tech stations
		// would be first, and high-tech stations last.

		this.loaded = true;
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
