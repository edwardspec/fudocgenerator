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
		// Array of objects (Item, Monster, etc.) that want to have an article.
		this.objects = [];
	}

	/**
	 * Inform the registry that this arbitrary object will need an article.
	 *
	 * @param {Object} arbitraryObject
	 */
	add( arbitraryObject ) {
		this.objects.push( arbitraryObject );
	}

	/**
	 * Find the final (chosen) PageName for the object (such as Item or Monster).
	 * This only works on items, etc. that were previously added via add().
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

	/* --------------------------------------------------------------------------------------------- */

	/**
	 * @private
	 * Assign titles to all objects that were previously added via PageNameRegistry.add().
	 */
	resolve() {
		// Measure performance (for logging).
		var timeStart = Date.now();
		util.log( '[info] PageNameRegistry: ' + this.objects.length + ' different objects were registered.' );

		var allCandidates = [];
		for ( var arbitraryObject of this.objects ) {
			var info = {
				object: arbitraryObject
			};

			var className = arbitraryObject.constructor.name;
			if ( className === 'Item' ) {
				var item = arbitraryObject;

				info.isItem = true;
				info.wantedTitle = item.displayName;

				if ( item.isCodex() ) {
					// (codex) suffix is mandatory for codex pages, even if there is no naming conflict.
					wantedTitle += ' (codex)';
				}
			} else if ( className === 'Monster' ) {
				var monster = arbitraryObject;

				info.isMonster = true;
				info.wantedTitle = monster.displayName;
			} else {
				throw new Error( 'PageNameRegistry.resolve(): Object has unsupported class: ' + className );
			}

			allCandidates.push( info );
		}

		// Group the candidates by wanted title.
		// Format: { wantedTitle1: [ candidateInfo1, candidateInfo2, ... ], ... }.
		var titleCandidates = new Map();
		for ( var info of allCandidates ) {
			var wantedTitle = info.wantedTitle;
			var competitors = titleCandidates.get( wantedTitle );
			if ( !competitors ) {
				competitors = [];
				titleCandidates.set( wantedTitle, competitors );
			}
			competitors.push( info );
		}

		// Find wanted titles that are not disputed by several objects.
		// Objects that requested them will be named immediately.
		this.objectToTitle = new Map();
		for ( var [ wantedTitle, candidates ] of titleCandidates ) {
			if ( candidates.length < 2 ) {
				// This title is not disputed: naming the object immediately.
				this.objectToTitle.set( candidates[0], wantedTitle );

				// Since this object was successfully named, remove it from titleCandidates.
				// Only the titles with conflicts will remain.
				titleCandidates.delete( wantedTitle );
				continue;
			}
		}

		// The only objects that are still in "titleCandidates" map are those with conflicts.
		util.log( '[info] PageNameRegistry: there is a competition for ' + titleCandidates.size + ' titles.' );

		// All candidates will be sorted in convenient order for resolving conflicts.
		var sortCallback = ( a, b ) => {
			return a.sortkey - b.sortkey;
		};

		// To resolve the conflicts, we need to analyze the objects in more detail.
		// For example, if we discover that "edible food" and "decorative object" want the same title,
		// that means that decorative object can be a placeable version of this food (from Plating Table),
		// and we can automatically add "(decorative)" suffix to pageName, thus resolving the conflict.
		for ( var [ wantedTitle, candidates ] of titleCandidates ) {
			// Count the Skath-specific items to know if it's ok to resolve conflict by adding "(Skath)" to title
			// (we won't do so if all conflicting items are Skath-specific).
			var skathItemsCount = 0,
				itemsCount = 0,
				monstersCount = 0;

			for ( var info of candidates ) {
				if ( info.isItem ) {
					// Add "tags" to items if we know we can potentially rename them.
					var item = info.object;
					if ( [ 'preparedFood', 'drink' ].includes( item.category ) ) {
						info.isFood = true;
					}

					if ( item.category === 'decorative' ) {
						info.isDecorative = true;
					}

					if ( item.itemCode.match( /outpost$/ ) ) {
						// Non-functional crafting stations on the Science Outpost.
						info.isDecorative = true;
					}

					if ( item.itemCode.match( /(^npc|npc$)/ ) ) {
						info.isNpcOnly = true;
					}

					if ( item.itemCode.includes( 'skath' ) ) {
						info.isSkath = true;
						skathItemsCount ++;
					}

					// Allows to sort the candidates from shortest ID to longest ID (convenient for resolving conflicts).
					info.sortkey = item.itemCode.length;
					itemsCount ++;
				} else if ( info.isMonster ) {
					var monster = info.object;
					if ( monster.type.includes( 'pet' ) ) {
						info.isPet = true;
					}
					info.sortkey = monster.type.length + 100000;
					monstersCount ++;
				}
			}

			candidates = candidates.sort( sortCallback );

			// Attempt to resolve the conflict.
			var conflictsBefore = candidates.length;
			for ( var i = 0; i < candidates.length - 1; i ++ ) {
				for ( var j = i + 1; j < candidates.length; j ++ ) {
					var a = candidates[i],
						b = candidates[j];

					// Check if objects "a" and "b" are a well-known type of conflict that we can resolve.

					// Detect decorative placeable food (e.g. "cactusjuiceobject")
					// that is a counterpart of real food (e.g. "cactusjuice").
					if ( a.isFood && b.isDecorative && ( a.object.itemCode + 'object' === b.object.itemCode ) ) {
						b.wantedTitle += ' (decorative)';
					}

					// Detect non-functional crafting stations on the Science Outpost.
					if ( b.isDecorative && ( a.object.itemCode + 'outpost' === b.object.itemCode ) ) {
						b.wantedTitle += ' (decorative)';
					}

					// Detect unobtainable items that are an NPC-only variant of player-obtainable variants.
					if ( b.isNpcOnly && ( a.object.itemCode === b.object.itemCode.replace( /(^npc|npc$)/ ) ) ) {
						b.wantedTitle += ' (NPC)';
					}

					// Detect pet-specific variants of wild monsters.
					if ( b.isPet && !a.isPet ) {
						b.wantedTitle += ' (pet)';
					}

					// Detect item/monster name collision.
					if ( a.isItem && b.isMonster ) {
						b.wantedTitle += ' (monster)';
					}
				}
			}

			// TODO: detect Skath-specific materials?

			var resultingTitles = [...new Set( candidates.map( ( x ) => x.wantedTitle ) )];
			if ( resultingTitles.length > 1 ) {
				console.log( resultingTitles.join( ', ' ) );
			}
		}

		require('process').exit();

		console.log( 'Resolving a conflict: pageName=' + wantedTitle +
			', candidates=' + itemCodes.join( ',' ) + ' || ' + monsterCodes.join( ',' ) );

		// Current approach is opportunistic renaming of pages that have a known type of disambiguation,
		// such as "NameOfFood" and "NameOfFood (decorative)".

		var solvedDuplicatesCount = 0;


		require('process').exit();






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
}

module.exports = new PageNameRegistry();
