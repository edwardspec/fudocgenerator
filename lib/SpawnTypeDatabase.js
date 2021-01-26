'use strict';

const { AssetDatabase, util } = require( '.' );

/**
 * Discovers all known spawn types.
 */
class SpawnTypeDatabase {
	constructor() {
		this.loaded = false;

		// Array of known spawntypes, e.g. { "furaptor": { ... }, ... }
		this.knownTypes = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all liquids.
	 */
	load() {
		AssetDatabase.forEach( 'spawntypes', ( filename, asset ) => {
			asset.data.forEach( ( spawnType ) => {
				this.knownTypes.set( spawnType.name, spawnType );
			} );
		} );

		util.log( '[info] SpawnTypeDatabase: found ' + this.knownTypes.size + ' spawn types.' );
		this.loaded = true;
	}

	/**
	 * Find the spawn type by its name.
	 *
	 * @param {int} name
	 * @return {Object|null} Arbitrary information about this spawn type.
	 */
	find( name ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownTypes.get( name );
	}
}

module.exports = new SpawnTypeDatabase();
