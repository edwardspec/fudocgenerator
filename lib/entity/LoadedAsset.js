'use strict';

const { config, util } = require( '..' );

/**
 * Represents one asset (parsed JSON file from either vanilla or the mod). Used in AssetDatabase.
 */
class LoadedAsset {
	/**
	 * @param {AssetDatabase} db Dependency injection of the AssetDatabase object.
	 * @param {Object} assetInfo Must contain keys: 'absolutePath' (string), 'filename' (string).
	 */
	constructor( db, assetInfo ) {
		Object.assign( this, assetInfo );
		this.db = db;

		if ( !this.absolutePath ) {
			// Can happen after JSON.parse(JSON.stringify(asset)).
			this.absolutePath = ( this.vanilla ? config.pathToVanilla : config.pathToMod ) +
				'/' + this.filename;
		}
	}

	/**
	 * Load this asset immediately. Sets this.data if successful.
	 *
	 * @return {Object|null} Value of this.data.
	 */
	loadNow() {
		var data = util.loadModFile( this.absolutePath );
		if ( !data ) {
			return null;
		}

		// Is there a patch?
		var patchAsset = this.db.knownPatches.get( this.filename );
		if ( patchAsset ) {
			// We need to apply instructions from patch to "this.data".
			this.db.applyPatchInstructions( patchAsset.data || patchAsset.loadNow(), data );

			// Just in case (not really used): remember the fact that this asset was patched.
			this.patched = true;
		}

		// Set this.data, which is used by everything except AssetDatabase.
		this.data = data;
		return data;
	}

	/**
	 * Returns the fields that must be included into JSON.stringify().
	 * This is used in AssetDatabase.updateCache().
	 * Note that "absolutePath" is excluded, because we can restore it from "filename" and "vanilla".
	 * Not saving this path reduces loading time.
	 */
	toJSON() {
		var ret = {
			filename: this.filename,
			vanilla: this.vanilla,
			type: this.type,
			data: this.data
		};
		if ( this.patched ) {
			ret.patched = true;
		}

		return ret;
	}
}

module.exports = LoadedAsset;
