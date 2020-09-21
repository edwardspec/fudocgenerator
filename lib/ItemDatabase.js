/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var util = require( './util' ),
	AssetDatabase = require( './AssetDatabase' );

class ItemDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = {};

		// Map of item names: { displayName: [ itemCode1, itemCode2, ... ], ... }.
		// This is used in situations when multiple items have the same name (e.g. "Ancient Artifact").
		this.displayNameToItemCodes = {};
	}

	/**
	 * Find all items in the AssetDatabase.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	load() {
		AssetDatabase.forEach( ( filename, asset ) => {
			if ( asset.fileExtension === '.recipe' ) {
				// Not an item.
				return;
			}

			var loadedData = asset.data;
			if ( loadedData.hasObjectItem === false ) {
				// There are objects like "Potato Seed" with 2 variants (wildpotatoseed and potatoseed).
				// Those marked with hasObjectItem=false can't be obtained by player and must be excluded.
				return;
			}

			var itemCode = loadedData.itemName || loadedData.objectName;
			if ( !itemCode ) {
				// Ignore incorrect items without the codename (like 'fu_carbon').
				util.log( '[warning] ItemDatabase: Ignoring file without itemName/objectName: ' + filename );
				return;
			}

			if ( !loadedData.shortdescription ) {
				// Ignore incorrect items without human-readable display name (like 'Liquid Erchius Fuel').
				util.log( '[warning] ItemDatabase: Ignoring file without shortdescription: ' + filename );
				return;
			}

			// Remove the color codes from the description (e.g. "^#e43774;" or "^reset;" ).
			var displayName = util.cleanDescription( loadedData.shortdescription );

			// Remove "[FU]" from names of items like 'Kiri Fruit [FU]', because it's not needed
			// and because symbols "[" and "]" can't be in wikipage titles.
			// (this suffix means that another popular mod, but not vanilla, has an item with this name)
			displayName = displayName.replace( /\s*\[FU\]\s*/, '' );

			if ( !this.displayNameToItemCodes[displayName] ) {
				this.displayNameToItemCodes[displayName] = [];
			}

			this.displayNameToItemCodes[displayName].push( itemCode );

			loadedData.displayName = displayName;
			loadedData.wikiPageName = displayName;
			this.knownItems[itemCode] = loadedData;
		} );

		// Find items with duplicate names.
		Object.keys( this.displayNameToItemCodes ).forEach( ( displayName ) => {
			var itemCodes = this.displayNameToItemCodes[displayName];
			if ( itemCodes.length < 2 ) {
				// Not a duplicate (only one item with this name).
				return;
			}

			// TODO: modify "wikiPageName" field for these items, so that it is unique for all items.
			// There shouldn't be two items with the same wikiPageName.
			// For example, the page of non-food "Cooked Shrimp" should be called "Cooked Shrimp (decorative)".

			var renamedCount = 0;

			itemCodes.forEach( ( itemCode ) => {
				var item = this.knownItems[itemCode],
					anotherCode;

				// Detect decorative placeable food (e.g. "cactusjuiceobject")
				// that is a counterpart of real food (e.g. "cactusjuice").
				anotherCode = itemCode.replace( /object$/, '' );
				if ( itemCode !== anotherCode ) {
					if ( itemCodes.indexOf( anotherCode ) != -1 ) {
						// Because we found another item without "object" suffix,
						// we can append "(decorative)" to the item WITH suffix.
						item.wikiPageName += ' (decorative)';
					}
				}

				// Detect wild seeds (e.g. "wildpotatoseed") as counterpart of obtainable seeds ("potatoseed").
				anotherCode = itemCode.replace( /^wild/, '' );
				if ( itemCode !== anotherCode ) {
					if ( itemCodes.indexOf( anotherCode ) != -1 ) {
						item.wikiPageName += ' (wild)';
					}
				}

				// Detect non-functional crafting stations on the Science Outpost.
				anotherCode = itemCode.replace( /outpost$/, '' );
				if ( itemCode !== anotherCode ) {
					if ( itemCodes.indexOf( anotherCode ) != -1 ) {
						item.wikiPageName += ' (decorative)';
					}
				}

				// Detect unobtainable items that are an NPC-only variant of player-obtainable variants.
				anotherCode = itemCode.replace( /^npc/, '' ).replace( /npc$/, '' );
				if ( itemCode !== anotherCode ) {
					if ( itemCodes.indexOf( anotherCode ) != -1 ) {
						item.wikiPageName += ' (NPC)';
					}
				}

				// TODO: Detect vertical/horizontal wiring objects like "3-Bit Sequencer" or "Compact XOR Gate".
				// This is slightly more troublesome, because the difference in IDs is a single h/r letter,
				// and it can be in the middle of ID.

				if ( item.displayName != item.wikiPageName ) {
					this.knownItems[itemCode] = item;
					renamedCount ++;

					util.log( '[debug] Disambig: renamed [' + itemCode + ']: ' + item.displayName + ' => ' + item.wikiPageName );
				}
			} );

			if ( itemCodes.length - renamedCount > 1 ) {
				util.log( '[debug] Item with duplicate name: ' + displayName + ': ' + itemCodes.join( ', ' ) );
			}
		} );

		util.log( '[info] ItemDatabase: found ' + Object.keys( this.knownItems ).length + ' items.' );
		this.loaded = true;
	}

	/**
	 * Find the item called "itemCode" in the database.
	 * @return {object|null} Arbitrary information about this item (depends on the type of item).
	 */
	find( itemCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownItems[itemCode];
	}

	/**
	 * Iterate over the entire database, calling the callback for each item.
	 * Callback gets the following parameters: 1) item code, 2) loaded data.
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var [ itemCode, loadedData ] of Object.entries( this.knownItems ) ) {
			callback( itemCode, loadedData );
		}
	}

	/**
	 * Find the human-readable name of item "itemCode" in the database (if any).
	 * If not found, then false is returned.
	 * @param {string|false} itemCode
	 * @return
	 */
	getDisplayName( itemCode ) {
		var item = this.find( itemCode );
		return item ? item.displayName : false;
	}

	/**
	 * Debugging method: print the entire database to STDOUT (for troubleshooting).
	 */
	dump() {
		console.log( JSON.stringify( this.knownItems, null, '  ' ) );
	}
}

module.exports = new ItemDatabase();
