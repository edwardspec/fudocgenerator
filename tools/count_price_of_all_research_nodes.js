/**
 * Count the sum of Research currency that is needed to unlock everything.
 */

'use strict';

const { ResearchTreeDatabase } = require( '../lib' );

let costByItem = {};

ResearchTreeDatabase.forEach( ( node ) => {
	node.price.getAllComponents().forEach( ( component ) => {
		let count = component.quantity.count;
		if ( !count ) {
			return;
		}

		if ( !costByItem[component.code] ) {
			costByItem[component.code] = 0;
		}

		costByItem[component.code] += count;
	} );
} );

console.log(
	( costByItem.fuscienceresource || 0 ) + ' of Research currency, ' +
	( costByItem.fumadnessresource || 0 ) + ' of Madness currency, ' +
	( costByItem.fugeneticmaterial || 0 ) + ' of Genes currency are needed to unlock ALL nodes.'
);
