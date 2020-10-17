/**
 * Makes the list of armors/weapons in the game (sorted by price).
 */

var process = require( 'process' ),
	ItemDatabase = require( '../lib/ItemDatabase' ),
	util = require( '../lib/util' );

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

var nonbuildscriptCount = 0;
var buildscriptItems = [];

var tierToMult = [ 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5 ];

ItemDatabase.forEach( ( code, item ) => {
	if ( mode == 'weapon' ) {
		if ( !item.itemTags || item.itemTags.indexOf( 'weapon' ) === -1 ) {
			// Not a weapon.
			return;
		}

		if ( item.level === undefined && item.itemName.match( 'npc' ) ) {
			// NPC-only weapon without Tier.
			return;
		}
	} else if ( mode === 'armor' ) {
		if ( !item.category || !item.category.match( /(armour|wear)$/ ) ) {
			// Not an armor.
			return;
		}
	}

	if ( !item.price ) {
		item.price = 0;
	}

	if ( item.builder ) {
		buildscriptItems.push( item );
	} else {
		nonbuildscriptCount ++;
	}
} );


buildscriptItems = buildscriptItems.sort( ( a, b ) => ( b.price - a.price ) );


console.log( '<!-- Buildscript items: ' + buildscriptItems.length + ', non-buildscript items: ' + nonbuildscriptCount + ' -->' );
console.log( '{| class="wikitable sortable"\n!Tier\n!ID\n!Name\n!Price\n!Price multiplied by tier-based multiplier\n!Price at tier 8' );

for ( var item of buildscriptItems ) {
	var line = '|-\n|' + ( item.level || '?' ) + ' || ' + item.itemName + ' || [[' + util.cleanDescription( item.shortdescription ) + ']] || ' + item.price;

	if ( !item.level ) {
		line += '|| ?';
	} else {
		line += ' ||' + util.trimFloatNumber( item.price * tierToMult[item.level], 2 );
	}

	line += ' ||' +  util.trimFloatNumber( item.price * tierToMult[8], 2 );

	console.log( line );
}

console.log( '|}' );
