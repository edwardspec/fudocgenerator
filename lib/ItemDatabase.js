/**
 * Allows to find items (objects, materials, etc.) in the mod sources by the item's codename.
 */

'use strict';
var config = require( '../config.json' ),
	{ AssetDatabase, util, Item } = require( '.' );

class ItemDatabase {
	constructor() {
		this.loaded = false;

		// Map of all known items: { itemCode: SomeDataStructure, ... }
		this.knownItems = {};

		// Map of wikipage title to item code.
		// Format: { "Potato Seed": "potatoseed", ... }.
		this.pageTitleToItemCode = {};
	}

	/**
	 * Find all items in the AssetDatabase.
	 * If found, they will be loaded into this ItemDatabase and can later be returned by find().
	 */
	load() {
		// Map of item names: { displayName: [ itemCode1, itemCode2, ... ], ... }.
		// This is used in situations when multiple items have the same name (e.g. "Ancient Artifact").
		var displayNameToItemCodes = {};

		AssetDatabase.forEach( 'item', ( filename, asset ) => {
			var item = new Item( asset ),
				itemCode = item.itemCode,
				displayName = item.displayName;

			if ( !itemCode ) {
				// Ignore incorrect items without the codename (like 'fu_carbon').
				util.log( '[warning] ItemDatabase: Ignoring file without itemName/objectName: ' + filename );
				return;
			}

			if ( item.hasObjectItem === false || itemCode.match( /^wild.*seed$/ ) ) {
				// There are objects like "Potato Seed" with 2 variants (wildpotatoseed and potatoseed).
				// Those marked with hasObjectItem=false can't be obtained by player and must be excluded.
				return;
			}

			if ( itemCode.match( '^scienceoutpostbanner' ) ) {
				// Collectable versions of items like Infinity Express.
				// Skip these, main item is already in the ItemDatabase.
				return;
			}

			if ( !item.shortdescription ) {
				// Ignore incorrect items without human-readable display name (like 'Liquid Erchius Fuel').
				util.log( '[warning] ItemDatabase: Ignoring file without shortdescription: ' + filename );
				return;
			}

			if ( !displayNameToItemCodes[displayName] ) {
				displayNameToItemCodes[displayName] = [];
			}

			displayNameToItemCodes[item.displayName].push( itemCode );
			this.knownItems[itemCode] = item;
		} );

		// { itemCode1: true, itemCode2: true, ... }
		var shouldIgnoreItem = {};
		config.ignoredItems.forEach( ( itemCode ) => { shouldIgnoreItem[itemCode] = true; } );

		// Find items with duplicate names.
		Object.keys( displayNameToItemCodes ).forEach( ( displayName ) => {
			var itemCodes = displayNameToItemCodes[displayName];
			if ( itemCodes.length < 2 ) {
				// Not a duplicate (only one item with this name).
				return;
			}

			// TODO: modify "wikiPageName" field for these items, so that it is unique for all items.
			// There shouldn't be two items with the same wikiPageName.
			// For example, the page of non-food "Cooked Shrimp" should be called "Cooked Shrimp (decorative)".

			var solvedDuplicatesCount = 0;

			// Count the Skath-specific items to know if it's ok to resolve conflict by adding "(Skath)" to title
			// (we won't do so if all conflicting items are Skath-specific).
			var skathItemsCount = itemCodes.filter( ( code ) => code.match( /skath/ ) ).length;

			itemCodes.forEach( ( itemCode ) => {
				var item = this.knownItems[itemCode],
					anotherCode;

				// Detect decorative placeable food (e.g. "cactusjuiceobject")
				// that is a counterpart of real food (e.g. "cactusjuice").
				anotherCode = itemCode.replace( /object$/, '' );
				if ( item.category === 'decorative' && itemCodes.length == 2 ) {
					// If there are only 2 items with this name, one is food and other is decorative,
					// then we always rename the decorative one (regardless of its code).
					anotherCode = itemCodes.filter( ( code ) => code !== itemCode )[0];

					var anotherCategory = this.knownItems[anotherCode].category;
					if ( [ 'preparedFood', 'drink' ].indexOf( anotherCategory ) !== -1 ) {
						item.wikiPageName += ' (decorative)';
					}
				}

				// Detect wild seeds (e.g. "wildpotatoseed") as counterpart of obtainable seeds ("potatoseed").
				anotherCode = itemCode.replace( /wild/, '' );
				if ( itemCode !== anotherCode ) {
					if ( itemCodes.indexOf( anotherCode ) != -1 ) {
						// Wild seeds don't need pages.
						item.wikiPageName = false;
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

				// Detect Skath-specific materials like "Reinforced Glass".
				if ( itemCode.match( /skath/ ) && skathItemsCount !== itemCodes.length ) {
					item.wikiPageName += ' (Skath)';
				}

				// TODO: Detect vertical/horizontal wiring objects like "3-Bit Sequencer" or "Compact XOR Gate".
				// This is slightly more troublesome, because the difference in IDs is a single h/r letter,
				// and it can be in the middle of ID.

				if ( !item.wikiPageName || shouldIgnoreItem[itemCode] ) {
					delete this.knownItems[itemCode];
					solvedDuplicatesCount ++;

					util.log( '[debug] Disambig: removing [' + itemCode + '] (' + item.displayName + ') as unneeded' );
				} else if ( item.displayName != item.wikiPageName ) {
					this.knownItems[itemCode] = item;
					solvedDuplicatesCount ++;

					util.log( '[debug] Disambig: renamed [' + itemCode + ']: ' + item.displayName + ' => ' + item.wikiPageName );
				}
			} );

			if ( itemCodes.length - solvedDuplicatesCount > 1 ) {
				util.log( '[debug] Item with duplicate name: ' + displayName + ': ' + itemCodes.join( ', ' ) );
			}
		} );

		// Allow config.json to override wikipage titles of some items.
		for ( var [ itemCode, wikiPageName ] of Object.entries( config.overrideItemPageTitles ) ) {
			this.knownItems[itemCode].wikiPageName = wikiPageName;
		}

		// Populate "pageTitleToItemCode" array for all items.
		for ( var [ itemCode, data ] of Object.entries( this.knownItems ) ) {
			this.pageTitleToItemCode[data.wikiPageName] = itemCode;
		}

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
	 * Find the ItemCode by the title of wiki article about this item.
	 * If not found, then false is returned.
	 * @param {string|false} wikiPageName
	 * @return
	 */
	findCodeByPageName( wikiPageName ) {
		return this.pageTitleToItemCode[wikiPageName];
	}

	/**
	 * Debugging method: print the entire database to STDOUT (for troubleshooting).
	 */
	dump() {
		console.log( JSON.stringify( this.knownItems, null, '  ' ) );
	}
}

module.exports = new ItemDatabase();
