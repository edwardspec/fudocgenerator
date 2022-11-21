/**
 * Count the sum of Research currency that is needed to unlock everything.
 */

'use strict';

const { ResearchTreeDatabase } = require( '../lib' );

let totalCost = 0;

ResearchTreeDatabase.forEach( ( node ) => {
	let researchCost = node.price.getAllComponents()
		.filter( ( component ) => component.code === 'fuscienceresource' )[0];

	if ( researchCost ) {
		totalCost += researchCost.quantity.count;
	}
} );

console.log( totalCost + ' of Research currency is needed to unlock ALL nodes.' );
