/**
 * Methods to search the non-persistent, in-memory database of "all known recipes".
 * Usage: first you add recipes via add(). Then you use makeSearchIndex().
 */

const ItemDatabase = require( './ItemDatabase' );

class CraftingStationDatabase {
	constructor() {
		// Array of all known crafting stations.
		this.knownStations = [];
	}

	/**
	 * Returns the name of crafting station that can craft the CraftingRecipe with these groups.
	 * @param string {groups} E.g. [ "chemlab2", "liquids", "all" ]
	 * @return {string|false}
	 */
	findByGroups( groups ) {
		// TODO: actually search the ItemDatabase for crafting station with matching "filter" attribute.
		return 'Unknown crafting station';
	}
}

module.exports = new CraftingStationDatabase();
