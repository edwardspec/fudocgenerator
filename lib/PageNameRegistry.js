'use strict';

const { util } = require( '.' );

/**
 * This registry decides "what would be the PageName of wiki article about Item, Monster, etc.",
 * resolving any naming conflicts (situations when two items are called the same and want the same title).
 *
 * @example
 * // First you inform the Registry that these items will need a PageTitle:
 * registry.addItem( item1 ); registry.addItem( item2 ); registry.addItem( item3 );
 * // ...
 * // Later, when all items are added into the Registry, you can start asking for "chosen" titles:
 * pageName = registry.getTitleFor( item1 );
 */
class PageNameRegistry {
	constructor() {
		// List of objects (Item, Monster, etc.) that want to have an article, grouped by desired PageName.
		// Format: { pageName1: [ object1, object2, ... ], ... } */
		this.pageNameCandidates = new Map();

		// Page names that are determined by resolve().
		// These are final (pages will not be further renamed if they are in these arrays).
		// Format: { object: pageName, ... } and { pageName: object, ... }
		this.objectToTitle = new Map();
		this.titleToObject = new Map();
	}

	/**
	 * Inform the registry that this Item object will need an article.
	 *
	 * @param {Item} item
	 */
	addItem( item ) {
		var wantedTitle = item.displayName;
		if ( item.isCodex() ) {
			// (codex) suffix is mandatory for codex pages, even if there is no naming conflict.
			wantedTitle += ' (codex)';
		}

		this.addObject( item, wantedTitle );
	}

	/**
	 * Inform the registry that this Monster object will need an article.
	 *
	 * @param {Monster} monster
	 */
	addMonster( monster ) {
		this.addObject( monster, monster.displayName );
	}

	/**
	 * Inform the registry that this arbitrary object will need an article.
	 * Because we don't know "what type of object is it", wanted PageName must be specified explicitly.
	 *
	 * @param {Object} arbitraryObject
	 * @param {string} wantedTitle
	 */
	addObject( arbitraryObject, wantedTitle ) {
		var candidates = this.pageNameCandidates.get( wantedTitle );
		if ( !candidates ) {
			candidates = [];
			this.pageNameCandidates.set( wantedTitle, candidates );
		}

		candidates.push( arbitraryObject );
	}

	/**
	 * Find the final (chosen) PageName for the object (such as Item or Monster).
	 * This only works on items, etc. that were previously added via addItem(), etc.
	 *
	 * @param {Object} arbitraryObject
	 * @return {string}
	 */
	getTitleFor( arbitraryObject ) {
		if ( !this.resolved ) {
			this.resolve();
		}

		var title = this.objectToTitle.get( arbitraryObject );
		if ( !title ) {
			throw new Error( 'getTitleFor() was called for an object that was never added to PageNameRegistry: ' );
		}

		return this.objectToTitle.get( arbitraryObject );
	}

	resolve() {
		// Measure performance (for logging).
		var timeStart = Date.now();

		util.log( '[info] PageNameRegistry: ' + this.pageNameCandidates.size + ' different titles were requested.' );
		var namesWithConflicts = 0;

		for ( var [ wikiPageName, candidates ] of this.pageNameCandidates ) {
			if ( candidates.length < 2 ) {
				// Not a duplicate (only one object with this name).
				this.setChosenTitle( candidates[0], wikiPageName );
				continue;
			}

			this.resolveConflicts( wikiPageName, candidates );
			namesWithConflicts++;
		}

		util.log( '[info] PageNameRegistry: resolve() took ' + ( Date.now() - timeStart ) / 1000 + 's.' );
		util.log( '[info] PageNameRegistry: there was a competition for ' + namesWithConflicts + ' titles.' );
		this.resolved = true;

		// Sanity check: after resolve() all titles are chosen and final, so addObject() won't do anything.
		this.addObject = () => {
			throw new Error( "Can't add new objects to PageNameRegistry after resolve()." );
		};
	}

	/**
	 * @private
	 * Remember the final (non-overridable) decision to assign PageName (string) to a specific object.
	 * This is called from resolve(), and shouldn't be used by external callers.
	 *
	 * @param {Object} arbitraryObject
	 * @param {string} chosenTitle
	 */
	setChosenTitle( arbitraryObject, chosenTitle ) {
		this.objectToTitle.set( arbitraryObject, chosenTitle );
		this.titleToObject.set( chosenTitle, arbitraryObject );
	}

	/**
	 * Assign unique page names to several "candidate" objects that requested the same wikiPageName.
	 *
	 * @param {string} wantedTitle Title that was requested by these objects.
	 * @param {Object[]} candidates Array of arbitrary objects.
	 */
	resolveConflicts( wantedTitle, candidates ) {
		// Determine the type of objects that compete for this wikiPageName.
		var items = {}; // { itemCode1: Item1, ... }
		var monsters = {}; // { monsterCode1: Monster1, ... }
		var result = {}; // { candidateObject: chosenTitle }

		for ( var elem of candidates ) {
			var className = elem.constructor.name;
			if ( className === 'Item' ) {
				items[elem.itemCode] = elem;
			} else if ( className === 'Monster' ) {
				monsters[elem.type] = elem;
			} else {
				throw new Error( 'PageNameRegistry.resolveConflicts: Object has unsupported class: ' + className );
			}
		}

		var itemCodes = Object.keys( items ),
			monsterCodes = Object.keys( monsters );

		console.log( 'Resolving a conflict: pageName=' + wantedTitle +
			', candidates=' + itemCodes.join( ',' ) + ' || ' + monsterCodes.join( ',' ) );

		// Current approach is opportunistic renaming of pages that have a known type of disambiguation,
		// such as "NameOfFood" and "NameOfFood (decorative)".

		// Count the Skath-specific items to know if it's ok to resolve conflict by adding "(Skath)" to title
		// (we won't do so if all conflicting items are Skath-specific).
		var skathItemsCount = itemCodes.filter( ( code ) => code.match( /skath/ ) ).length;

		var solvedDuplicatesCount = 0;
		itemCodes.forEach( ( itemCode ) => {
			var item = items[itemCode],
				anotherCode;

			// Detect decorative placeable food (e.g. "cactusjuiceobject")
			// that is a counterpart of real food (e.g. "cactusjuice").
			anotherCode = itemCode.replace( /object$/, '' );
			if ( item.category === 'decorative' && itemCodes.length == 2 ) {
				// If there are only 2 items with this name, one is food and other is decorative,
				// then we always rename the decorative one (regardless of its code).
				anotherCode = itemCodes.filter( ( code ) => code !== itemCode )[0];

				var anotherCategory = items[anotherCode].category;
				if ( [ 'preparedFood', 'drink' ].includes( anotherCategory ) ) {
					result[item] = wantedTitle + ' (decorative)';
				}
			}

			// Detect non-functional crafting stations on the Science Outpost.
			anotherCode = itemCode.replace( /outpost$/, '' );
			if ( itemCode !== anotherCode ) {
				if ( itemCodes.indexOf( anotherCode ) != -1 ) {
					result[item] = wantedTitle + ' (decorative)';
				}
			}

			// Detect unobtainable items that are an NPC-only variant of player-obtainable variants.
			anotherCode = itemCode.replace( /^npc/, '' ).replace( /npc$/, '' );
			if ( itemCode !== anotherCode ) {
				if ( itemCodes.indexOf( anotherCode ) != -1 ) {
					result[item] = wantedTitle + ' (NPC)';
				}
			}

			// Detect Skath-specific materials like "Reinforced Glass".
			if ( itemCode.match( /skath/ ) && skathItemsCount !== itemCodes.length ) {
				result[item] = wantedTitle + ' (Skath)';
			}

			// TODO: Detect vertical/horizontal wiring objects like "3-Bit Sequencer" or "Compact XOR Gate".
			// This is slightly more troublesome, because the difference in IDs is a single h/r letter,
			// and it can be in the middle of ID.

			if ( result[item] ) {
				solvedDuplicatesCount++;
				util.log( '[debug] Disambig: renamed [' + itemCode + ']: ' + item.displayName + ' => ' + result[item] );
			} else {
				result[item] = wantedTitle;
			}
		} );

		if ( itemCodes.length - solvedDuplicatesCount > 1 ) {
			util.log( '[debug] Item with duplicate name: ' + result[item] + ': ' + itemCodes.join( ', ' ) );
		}

		for ( var [ candidate, chosenTitle ] of Object.entries( result ) ) {
			this.setChosenTitle( candidate, chosenTitle );
		}
	}
}

module.exports = new PageNameRegistry();
