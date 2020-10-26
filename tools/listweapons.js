/**
 * Makes the list of armors/weapons in the game (sorted by price).
 */

'use strict';

const process = require( 'process' ),
	{ ItemDatabase, util } = require( '../lib' );

var mode;
switch ( process.argv[2] ) {
	case 'weapon':
		mode = 'weapon';
		break;

	case 'armor':
		mode = 'armor';
		break;

	default:
		console.log( process.argv );
		throw new Error( 'Usage:\n\tnode listweapons.js weapon\n\tnode listweapons.js armor' );
}

var buildscriptItems = [];
var tierToMult = [ 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5 ];

ItemDatabase.forEach( ( code, item ) => {
	if ( item.builder ) {
		if ( mode == 'weapon' && !item.builder.match( /\/buildunrandweapon\.lua$/ ) ) {
			// Not a weapon
			return;
		}

		if ( mode == 'armor' && !item.builder.match( /\/fubuildarmor\.lua$/ ) ) {
			// Not an armor.
			return;
		}

		if ( item.level === undefined && item.itemName.match( 'npc' ) ) {
			// NPC-only weapon without Tier.
			return;
		}

		buildscriptItems.push( item );
	}
} );


buildscriptItems = buildscriptItems.sort( ( a, b ) => ( b.price - a.price ) );


console.log( '<!-- Buildscript items: ' + buildscriptItems.length + ' -->' );
console.log( '{| class="wikitable sortable"\n!Tier\n!ID\n!Name\n!Price\n!Price multiplied by tier-based multiplier\n!Price at tier 8' );

for ( var item of buildscriptItems ) {
	var line = '|-\n|' + ( item.level || '?' ) + ' || ' + item.itemName + ' || [[' + util.cleanDescription( item.shortdescription ) + ']] ';

	if ( item.level === undefined ) {
		line += '|| ' + item.price +  ' || ? || ?';
	} else {
		var priceWithoutMultiplier = item.price / tierToMult[item.level];

		line += '|| ' + util.trimFloatNumber( priceWithoutMultiplier, 2 );
		line += '|| ' + item.price;
		line += '|| ' + util.trimFloatNumber( priceWithoutMultiplier * tierToMult[8], 2 );
	}

	console.log( line );
}

console.log( '|}' );
