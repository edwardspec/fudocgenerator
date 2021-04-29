'use strict';
const { config, AssetDatabase, PageNameRegistry, util, Item } = require( '.' );

/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */
class ItemDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = new Map();
	}

	/**
	 * Add one Item object to "knownItems" and other indexes. This is used by load().
	 *
	 * @param {Item} item
	 */
	addToKnown( item ) {
		this.knownItems.set( item.itemCode, item );
		PageNameRegistry.add( item );
	}

	/**
	 * Find all items in the AssetDatabase.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	load() {
		var ignoredItemsList = new Set( config.ignoredItems );

		AssetDatabase.forEach( 'item', ( filename, asset ) => {
			var item;
			if ( asset.data.contentPages ) {
				item = Item.newFromCodex( asset );
			} else {
				item = new Item( asset );
			}

			var itemCode = item.itemCode;
			if ( !itemCode ) {
				// Ignore incorrect items without the codename (like 'fu_carbon').
				util.log( '[warning] ItemDatabase: Ignoring file without itemName/objectName: ' + filename );
				return;
			}

			if ( ignoredItemsList.has( itemCode ) ) {
				util.log( '[info] ItemDatabase: Ignoring ' + itemCode + ' (in ignoredItems list of config.json).' );
				return;
			}

			if ( item.hasObjectItem === false ) {
				// These are objects like Precursor obelisks.
				// They can't be obtained by player and must be excluded.
				return;
			}

			if ( item.category === 'seed' && itemCode.match( /(^|_)wild/ ) ) {
				// Wild seeds, e.g. "isn_wildmeatplant" or "wildpotatoseed". They can't be obtained by player.
				util.log( '[info] ItemDatabase: Ignoring ' + itemCode + ' (wild seed).' );
				return;
			}

			if ( itemCode.startsWith( 'scienceoutpostbanner' ) ) {
				// Collectable versions of items like Infinity Express.
				// Skip these, main item is already in the ItemDatabase.
				return;
			}

			if ( !item.shortdescription ) {
				// Ignore incorrect items without human-readable display name (like 'Liquid Erchius Fuel').
				util.log( '[warning] ItemDatabase: Ignoring file without shortdescription: ' + filename );
				return;
			}

			this.addToKnown( item );

			// For multi-stage buildings (e.g. Inventor's Table -> Engineer's Table)
			// we create pseudo-items with ID "<id_of_main_item>:2", "<id_of_main_item>:3", etc.
			for ( var subitem of item.upgradedItems ) {
				this.addToKnown( subitem );
			}
		} );

		util.log( '[info] ItemDatabase: found ' + this.knownItems.size + ' items.' );
		this.loaded = true;
	}

	/**
	 * Find the item called "itemCode" in the database.
	 *
	 * @param {string} itemCode
	 * @return {Object|null} Arbitrary information about this item (depends on the type of item).
	 */
	find( itemCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownItems.get( itemCode );
	}

	/**
	 * Iterate over the entire database, calling the callback for each item.
	 * Callback gets the following parameters: 1) item code, 2) loaded data.
	 *
	 * @param {itemCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ itemCode, loadedData ] of this.knownItems ) {
			callback( itemCode, loadedData );
		}
	}

	/**
	 * Callback expected by ItemDatabase.forEach().
	 *
	 * @callback itemCallback
	 * @param {string} itemCode
	 * @param {Item} item
	 */

	/**
	 * Find the human-readable name of item "itemCode" in the database (if any).
	 * If not found, then false is returned.
	 *
	 * @param {string|false} itemCode
	 * @return {string|false}
	 */
	getDisplayName( itemCode ) {
		var item = this.find( itemCode );
		return item ? item.displayName : false;
	}

	/**
	 * Find the ItemCode by the title of wiki article about this item.
	 * If not found, then false is returned.
	 *
	 * @param {string|false} wikiPageName
	 * @return {string|undefined}
	 */
	findCodeByPageName( wikiPageName ) {
		var item = PageNameRegistry.getObjectByTitle( wikiPageName, 'Item' );
		return item ? item.itemCode : undefined;
	}
}

module.exports = new ItemDatabase();
