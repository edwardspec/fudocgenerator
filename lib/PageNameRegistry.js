'use strict';

const { config, util } = require( '.' );

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

		// Format: { Item1: "pageName1", Item2: "pageName2", Monster3: "pageName3", ... }
		this.objectToTitle = new Map();

		// Format: { "pageName1": Item1, ... }
		this.titleToObject = new Map();
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
	 * Returns empty string if no title was allocated.
	 * Note: it's actually acceptable to use empty string in wikitext links (such as "[[|A]]"),
	 * because MediaWiki has a "pipe trick" syntax ("[[|A]]" becomes "[[A]]" when the page is saved).
	 *
	 * @param {Object} arbitraryObject
	 * @return {string|undefined}
	 */
	getTitleFor( arbitraryObject ) {
		if ( !this.resolved ) {
			this.resolve();
		}

		return this.objectToTitle.get( arbitraryObject ) || '';
	}

	/* --------------------------------------------------------------------------------------------- */

	/**
	 * @private
	 * Remember the final (non-overridable) decision to assign PageName (string) to a specific object.
	 * This is called from resolve(), and shouldn't be used by external callers.
	 *
	 * @param {Object} arbitraryObject
	 * @param {string} chosenTitle
	 */
	setChosenTitle( arbitraryObject, chosenTitle ) {
		if ( this.titleToObject.has( chosenTitle ) ) {
			// Sanity check: the very purpose of PageNameRegistry is to assign unique titles.
			throw new Error( 'PageNameRegistry: attempted to assign the same title to different objects: ' + chosenTitle );
		}

		this.objectToTitle.set( arbitraryObject, chosenTitle );
		this.titleToObject.set( chosenTitle, arbitraryObject );
	}
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
				info.wantedTitle = config.overrideItemPageTitles[item.itemCode] || item.displayName;
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
		var titleCandidates = this.groupCandidatesByTitle( allCandidates );

		// Find wanted titles that are not disputed by several objects.
		// Objects that requested them will be named immediately.
		this.allocateUndisputedTitles( titleCandidates );

		// The only objects that are still in "titleCandidates" map are those with conflicts.
		util.log( '[info] PageNameRegistry: there is a competition for ' + titleCandidates.size + ' titles.' );

		// To resolve the conflicts, we need to analyze the objects in more detail.
		// For example, if we discover that "edible food" and "decorative object" want the same title,
		// that means that decorative object can be a placeable version of this food (from Plating Table),
		// and we can automatically add "(decorative)" suffix to pageName, thus resolving the conflict.
		for ( var candidates of titleCandidates.values() ) {
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
					}

					if ( item.itemCode.match( /painting/ ) ) {
						info.isPainting = true;
					}

					// Allows to sort the candidates from shortest ID to longest ID (convenient for resolving conflicts).
					info.sortkey = item.itemCode.length;
				} else if ( info.isMonster ) {
					var monster = info.object;
					if ( monster.type.includes( 'pet' ) ) {
						info.isPet = true;
					}
					info.sortkey = monster.type.length + 100000;
				}
			}
		}

		this.attemptResolvingPass( titleCandidates );

		util.log( '[info] PageNameRegistry: resolve() took ' + ( Date.now() - timeStart ) / 1000 + 's.' );
		this.resolved = true;

		// Sanity check: after resolve() all titles are chosen and final, so addObject() won't do anything.
		this.addObject = () => {
			throw new Error( "Can't add new objects to PageNameRegistry after resolve()." );
		};
	}

	/**
	 * Group the array of "candidate" objects by title.
	 *
	 * @param {Object[]} candidates Flat array of "candidate" objects.
	 * @param {Map|null} targetMap If defined, results will be added to this Map (instead of creating a new Map).
	 * @return {Map} Resulting map. Format: { wantedTitle1: candidatesArray1, ... }.
	 */
	groupCandidatesByTitle( candidates, targetMap ) {
		if ( !targetMap ) {
			targetMap = new Map();
		}

		for ( var info of candidates ) {
			var wantedTitle = info.wantedTitle;
			var competitors = targetMap.get( wantedTitle );
			if ( !competitors ) {
				competitors = [];
				targetMap.set( wantedTitle, competitors );
			}
			competitors.push( info );
		}

		return targetMap;
	}

	/**
	 * Immediately name the objects that are the only candidate for the title they requested.
	 *
	 * @param {Map} titleCandidates Candidates grouped by title. Format: { wantedTitle1: candidatesArray1, ... }
	 */
	allocateUndisputedTitles( titleCandidates ) {
		for ( var [ wantedTitle, candidates ] of titleCandidates ) {
			if ( candidates.length < 2 ) {
				// This title is not disputed: naming the object immediately.
				this.setChosenTitle( candidates[0].object, wantedTitle );

				// Since this object was successfully named, remove it from titleCandidates.
				// Only the titles with conflicts will remain.
				titleCandidates.delete( wantedTitle );
				continue;
			}
		}
	}

	/**
	 * Walks over the list { wantedTitle1: candidatesArray1, ... }, renaming any conflicts if possible.
	 *
	 * @param {Map} titleCandidates
	 */
	attemptResolvingPass( titleCandidates ) {
		var newTitleCandidates = new Map();

		// Attempt to resolve the conflicts.
		for ( var candidates of titleCandidates.values() ) {
			candidates = candidates.sort( PageNameRegistry.candidateSortingCallback );
			this.attemptRenameRecursive( candidates );

			// Keep track of how many collisions are still left (or were created by renaming).
			this.groupCandidatesByTitle( candidates, newTitleCandidates );
		}

		this.allocateUndisputedTitles( newTitleCandidates );
		if ( titleCandidates.size === newTitleCandidates.size ) {
			util.log( 'attemptResolvingPass(): no changes in the number of remaining conflicts (' +
				titleCandidates.size + '), exiting.' );
			return;
		}

		util.log( '[notice] PageNameRegistry: processed ' + titleCandidates.size + ' collisions. ' +
			'Still remaining collisions (' + newTitleCandidates.size + '): ' +
			[...newTitleCandidates.keys()].sort().join( ', ' )
		);

		// We do at least one additional pass in case we introduced a new collision by renaming.
		this.attemptResolvingPass( newTitleCandidates );
	}

	/**
	 * Sort the candidates in convenient order for resolving conflicts.
	 *
	 * @param {Object} a
	 * @param {Object} b
	 * @return {int}
	 */
	static candidateSortingCallback( a, b ) {
		return a.sortkey - b.sortkey;
	}

	/**
	 * Given the array of candidates, rename all that can be renamed.
	 *
	 * @param {Object[]} candidates Each element is candidate info (structure with keys "wantedTitle", "object", etc.).
	 */
	attemptRenameRecursive( candidates ) {
		var wantedTitle = candidates[0].wantedTitle;
		for ( var i = 0; i < candidates.length - 1; i++ ) {
			for ( var j = i + 1; j < candidates.length; j++ ) {
				var a = candidates[i],
					b = candidates[j];

				// Check if objects "a" and "b" are a well-known type of conflict that we can resolve.
				var renamedCandidate = this.attemptRename( a, b );
				if ( renamedCandidate ) {
					// Some item was renamed, we should restart this loop with not-yet-renamed items.
					var candidatesExceptRenamedOne = candidates.filter( ( x ) => x !== renamedCandidate );
					if ( candidatesExceptRenamedOne.length === 1 ) {
						// No more conflict: only one non-renamed candidate is left.
						util.log( '[info] PageNameRegistry: renamed: ' + wantedTitle + ' => ' + renamedCandidate.wantedTitle );
						return;
					}

					this.attemptRenameRecursive( candidatesExceptRenamedOne );
					return;
				}
			}
		}
	}

	/**
	 * Attempt to rename one of the candidates (either "a" or "b") by modifying its "wantedTitle" properly.
	 * Returns the renamed candidate (either "a" or "b") or null (if no possibility for renaming was found).
	 *
	 * @param {Object} a Candidate info (structure with keys "wantedTitle", "object", "isItem", etc.).
	 * @param {Object} b Same as "a", but for another candidate.
	 * @return {Object|null}
	 */
	attemptRename( a, b ) {
		// Detect decorative placeable food (e.g. "cactusjuiceobject")
		// that is a counterpart of real food (e.g. "cactusjuice").
		if ( a.isFood && b.isDecorative && ( a.object.itemCode + 'object' === b.object.itemCode ) ) {
			b.wantedTitle += ' (decorative)';
			return b;
		}

		// Detect non-functional crafting stations on the Science Outpost.
		if ( b.isDecorative && ( a.object.itemCode + 'outpost' === b.object.itemCode ) ) {
			b.wantedTitle += ' (decorative)';
			return b;
		}

		// Detect unobtainable items that are an NPC-only variant of player-obtainable variants.
		if ( b.isNpcOnly && ( a.object.itemCode === b.object.itemCode.replace( /(^npc|npc$)/, '' ) ) ) {
			b.wantedTitle += ' (NPC)';
			return b;
		}

		// Detect pet-specific variants of wild monsters.
		if ( b.isPet && !a.isPet ) {
			b.wantedTitle += ' (pet)';
			return b;
		}

		// Detect item/monster name collision.
		if ( a.isItem && b.isMonster ) {
			if ( a.isPainting ) {
				a.wantedTitle += ' (painting)';
				return a;
			}

			b.wantedTitle += ' (monster)';
			return b;
		}

		// Detect Skath-specific materials.
		if ( b.isSkath && !a.isSkath ) {
			b.wantedTitle += ' (Skath)';
			return b;
		}

		return null;
	}
}

module.exports = new PageNameRegistry();
