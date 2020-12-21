/**
 * Discovers all known in-world materials.
 * NOTE: this doesn't contain matitems! (see ItemDatabase for those)
 */

'use strict';

const { AssetDatabase, util } = require( '.' );

class MaterialDatabase {
	constructor() {
		this.loaded = false;

		// Array of known materials by numeric ID,
		// e.g. { "6544": { "materialId" : 6544, "materialName": "blackslime", ... }, ... }
		this.knownMaterials = new Map();

		// Array of known materials by their name,
		// e.g. { "blackslime": { "materialId" : 6544, "materialName": "blackslime", ... }, ... }
		this.knownMaterialsByName = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all materials.
	 */
	load() {
		AssetDatabase.forEach( 'material', ( filename, asset ) => {
			var material = asset.data;

			this.knownMaterials.set( material.materialId, material );
			this.knownMaterialsByName.set( material.materialName, material );
		} );

		util.log( '[info] MaterialDatabase: found ' + this.knownMaterials.size + ' materials.' );

		this.loaded = true;
	}

	/**
	 * Find the material by its ID.
	 *
	 * @param {int} materialId
	 * @return {Object|null} Arbitrary information about this material.
	 */
	find( materialId ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownMaterials.get( materialId );
	}

	/**
	 * Find the material by its name.
	 *
	 * @param {string} materialName
	 * @return {Object|null} Arbitrary information about this material.
	 */
	findByName( materialName ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownMaterialsByName.get( materialName );
	}
}

module.exports = new MaterialDatabase();
