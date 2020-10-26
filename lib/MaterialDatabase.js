/**
 * Discovers all known in-world materials.
 * NOTE: this doesn't contain matitems! (see ItemDatabase for those)
 */

'use strict';

const { AssetDatabase, util } = require( '.' );

class MaterialDatabase {
	constructor() {
		this.loaded = false;

		// Array of known materials,
		// e.g. { "blackslime": { "materialName": "blackslime", ... }, ... }
		this.knownMaterials = {};
	}

	/**
	 * Scan the AssetDatabase and find all materials.
	 */
	load() {
		AssetDatabase.forEach( 'material', ( filename, asset ) => {
			var material = asset.data;
			this.knownMaterials[material.materialName] = material;
		} );

		util.log( '[info] MaterialDatabase: found ' + Object.keys( this.knownMaterials ).length + ' materials.' );

		this.loaded = true;
	}

	/**
	 * Find the materials by its name.
	 * @param string materialName
	 * @return {object|null} Arbitrary information about this material.
	 */
	find( materialName ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownMaterials[materialName];
	}
}

module.exports = new MaterialDatabase();
