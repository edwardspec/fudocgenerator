/**
 * Methods to search the non-persistent, in-memory database of "all known recipes".
 * Usage: first you add recipes via add(). Then you use makeSearchIndex().
 */

const ItemDatabase = require( './ItemDatabase' ),
	util = require( './util' );

class CraftingStationDatabase {
	constructor() {
		this.loaded = false;

		// Array of all known crafting stations, e.g. [ "Wiring Station", "Iron Anvil" ].
		this.knownStations = [];

		// Map of crafting recipe group (e.g. "chemlab2" ) to the array of crafting stations,
		// e.g. { "somegroup": [ "Station name 1", "Another station" ] }
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
					this.add( data.displayName, groups );
				}
			}

			// Handle stations like "craftingfurnace" or "prototyper",
			// which only have have "filter" in their upgradeStages array.
			if ( data.upgradeStages ) {
				// NOTE: because we search "upgradeStages" from first to last, low-tech stations are added first
				// (given a priority in findByGroups), which is exactly what we want:
				// if some item can be made at low-tech station, we shouldn't say "it needs a high-tech station".
				for ( var stageInfo of data.upgradeStages ) {
					var interactData = stageInfo.interactData;
					if ( !interactData ) {
						// Nothing is crafted here.
						continue;
					}

					var groups = interactData.filter;
					if  ( !groups ) {
						// Nothing is crafted here.
						continue;
					}

					var description = stageInfo.shortdescription;
					if ( !description && interactData.paneLayoutOverride &&
						interactData.paneLayoutOverride.windowtitle
					) {
						// Some stations (such as Armory) modify the UI directly instead of having shortdescription.
						description = interactData.paneLayoutOverride.windowtitle.title;
					}

					if ( !description ) {
						util.log( "[error] Couldn't find the visible name of the crafting station: " + itemCode );
						continue;
					};

					this.add( util.cleanDescription( description ), groups );
				}
			}
		} );

		util.log( '[info] Loaded crafting stations (' + this.knownStations.length + '): ' + this.knownStations.join( ', ' ) );

		this.loaded = true;
	}

	/**
	 * Remember this station's groups for use in findByGroups().
	 * @param {string} itemName
	 * @param {string[]} groups
	 */
	add( itemName, groups ) {
		this.knownStations.push( itemName );

		for ( var group of groups ) {
			if ( !this.knownStationsForGroup[group] ) {
				this.knownStationsForGroup[group] = [];
			}

			this.knownStationsForGroup[group].push( itemName );
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
				return this.knownStationsForGroup[group][0];
			}
		}

		// Haven't found a station that can craft this.
		return false;
	}
}

module.exports = new CraftingStationDatabase();