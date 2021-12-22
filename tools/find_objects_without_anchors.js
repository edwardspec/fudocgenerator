/**
 * Find placeable objects that don't have the necessary placement anchors.
 */

'use strict';

var { ItemDatabase } = require( '../lib' );

ItemDatabase.forEach( ( itemCode, item ) => {
	( item.orientations || [] ).forEach( ( placement ) => {
		if ( !placement.anchors && !placement.fgAnchors && !placement.bgAnchors ) {
			console.log( itemCode, placement );
		}
	} );
} );
