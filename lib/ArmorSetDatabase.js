'use strict';

const { ArmorSet, ItemDatabase, util } = require( '.' );

// Items with these categories are considered to be part of Armor Sets.
// Note: 1-piece and 2-piece sets are allowed.
const armorSlots = {
	headarmour: 'head',
	headwear: 'head',
	chestarmour: 'chest',
	chestwear: 'chest',
	legarmour: 'legs',
	legwear: 'legs'
};

/**
 * Discovers all known armor sets.
 */
class ArmorSetDatabase {
	constructor() {
		this.loaded = false;

		// Array of known armor sets,
		// e.g. { "fuquantumadv": ArmorSet1, "fulightpriest": ArmorSet2, ... }
		this.knownSets = new Map();
	}

	/**
	 * Scan the ItemDatabase and find all armor sets.
	 */
	load() {
		ItemDatabase.forEach( ( itemCode, item ) => {
			var slot = armorSlots[item.category];
			if ( !slot ) {
				// Not an armor.
				return;
			}

			// Because of how items are named, "somethinghead" and "somethingchest" are likely in the same set.
			var setId = itemCode.replace( /(head|chest|legs|pants)/g, '' );
			var set = this.knownSets.get( setId );
			if ( !set ) {
				// Discovered a new set.
				set = new ArmorSet( setId );
				this.knownSets.set( setId, set );
			}

			set.addItem( item, slot );
		} );

		util.log( '[info] ArmorSetDatabase: found ' + this.knownSets.size + ' sets (including 1-piece sets).' );

		this.loaded = true;
	}

	/**
	 * Iterate over the entire database, calling the callback for each armor set.
	 * Callback receives 1 parameter (ArmorSet object).
	 *
	 * @param {armorSetCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var set of this.knownSets.values() ) {
			callback( set );
		}
	}

	/**
	 * Callback expected by ArmorSetDatabase.forEach().
	 *
	 * @callback armorSetCallback
	 * @param {ArmorSet} armorSet
	 */
}

module.exports = new ArmorSetDatabase();
