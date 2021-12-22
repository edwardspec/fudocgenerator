/**
 * Find all items that are unlocked by more than one ResearchTree node
 * (excluding race-specific default unlocks).
 */

'use strict';

const { ResearchTreeDatabase } = require( '../lib' );

// Format: { itemCode => [ node1, node2, ... ], ... }
var nodesThatUnlock = {};

ResearchTreeDatabase.forEach( ( node ) => {
	if ( node.tree == 'No' && node.name != 'Default unlocks' ) {
		// We ignore race-specific default unlocks,
		// because it's not an error if these items are also unlocked via the regular ResearchTree.
		return;
	}

	for ( let itemCode of node.unlocks ) {
		if ( !nodesThatUnlock[itemCode] ) {
			nodesThatUnlock[itemCode] = [];
		}

		nodesThatUnlock[itemCode].push( node );
	}
} );

for ( let [ itemCode, nodes ] of Object.entries( nodesThatUnlock ) ) {
	if ( nodes.length < 2 ) {
		// Only unlocked by one node.
		continue;
	}

	console.log( itemCode + ': ' + nodes.map( ( node ) => {
		return node.name + ' (' + node.tree + ' tree)';
	} ).join( ', ' ) );
}
