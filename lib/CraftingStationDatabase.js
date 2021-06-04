'use strict';

const { config, ItemDatabase, RemoveBadSymbols, util } = require( '.' );

/**
 * Discovers all items in the ItemDatabase that can function as crafting stations.
 * Provides findByGroups( [ group1, group2, ... ] ) method to find the necessary station.
 */
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
		// Some recipes are craftable by hand (via "Crafting" menu), they don't require crafting stations.
		this.add( 'Basic Crafting', [ 'plain', 'primitive' ] );

		// Find items that can act as crafting stations.
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

			if ( data.recipeGroup && data.shortdescription ) {
				// Trivial processing stations (such as Hi-Tech Toaster or Rain Barrel).
				if ( itemCode == 'honeyextractor' ) {
					// Pre-beevamp recipes, no longer used.
					// The recipes for honey extraction are now in dedicated JSON file, not in *.recipe files.
					return;
				}

				this.add( RemoveBadSymbols.fromName( data.shortdescription ), [ data.recipeGroup ] );
			}

			// TODO: should we exclude specialized crafting stations, like Rustic Skath Forge or Crystal Workbench?
			if ( data.interactData && data.interactData.filter ) {
				// Remember this crafting station.
				this.add( data.displayName, data.interactData.filter );
			}
		} );

		util.log( '[info] Loaded crafting stations (' + this.knownStations.length + '): ' + this.knownStations.join( ', ' ) );

		this.loaded = true;
	}

	/**
	 * Remember this station's groups for use in findByGroups().
	 *
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
	 *
	 * @param {string[]} groups E.g. [ "chemlab2", "liquids", "all" ]
	 * @return {string|false}
	 */
	findByGroups( groups ) {
		if ( !this.loaded ) {
			this.load();
		}

		// Find all stations that can craft this.

		var candidates = [];
		for ( var group of groups ) {
			if ( this.knownStationsForGroup[group] ) {
				// Found a station that can craft this.
				candidates = candidates.concat( this.knownStationsForGroup[group] );
			}
		}

		if ( candidates.length == 0 ) {
			// None of the known stations can craft this.
			return false;
		}

		// Remove duplicate names from the candidates[] array.
		candidates = Array.from( new Set( candidates ) );

		if ( candidates.length == 1 ) {
			// Only one station can craft this.
			return candidates[0];
		}

		// There are several competing stations. We must select one of them by the following principles:
		// 1) It must be the "lowest tier" station: if even a low-tier station can craft this, then
		// it wouldn't be right to say "this requires <name of high-tier station> that also crafts this".
		// 2) race-specific stations (like Skath Industrial Workbench) have lower priority than stations
		// that are available to most players (like Agricultural Table).

		for ( var station of config.craftingStationPriorities ) {
			if ( candidates.indexOf( station ) !== -1 ) {
				return station;
			}
		}

		// All stations are of low priority, so pick the first one.
		return candidates[0];
	}
}

module.exports = new CraftingStationDatabase();
