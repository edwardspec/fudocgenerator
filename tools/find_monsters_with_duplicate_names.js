/**
 * List all monster names that are shared by more than 1 monster.
 */

'use strict';

var { MonsterDatabase } = require( '../lib' );

MonsterDatabase.load();
for ( var [ displayName, monsters ] of MonsterDatabase.knownMonstersByName ) {
	if ( monsters.length < 2 ) {
		// Only one monster has this name.
		continue;
	}

	console.log( displayName + ': ' + monsters.map( ( monster ) => monster.type ).join( ', ' ) );
}
