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
	 * Creates a pseudo-asset with the same paths, type, etc. as in "parentAsset".
	 * This is used by Item objects that represent a building with multiple upgrade stages
	 * (each of those stages is an Item object that needs its own LoadedAsset).
	 *
	 * @param {LoadedAsset} parentAsset
	 * @param {Object} childData Value of "data" in the newly created child asset.
	 * @return {LoadedAsset}
	 */
	static newChildAsset( parentAsset, childData ) {
		var assetInfo = {
			filename: parentAsset.filename,
			absolutePath: parentAsset.absolutePath,
			vanilla: parentAsset.vanilla,
			type: parentAsset.type,
			data: childData
		};
		return new LoadedAsset( parentAsset.db, assetInfo );
	}

	/**
	 * Load this asset immediately. Sets this.data if successful.
	 *
	 * @return {Object|null} Value of this.data.
	 */
	loadNow() {
		var data = {};
		if ( !this.notJson ) {
			data = util.loadModFile( this.absolutePath );
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

			// Remove keys that we don't use (reduces cache size, improves loading time).
			util.removeIrelevantAssetKeys( data );
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
	 *
	 * @return {Object}
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
		if ( this.overwrittenVanilla ) {
			ret.overwrittenVanilla = true;
		}

		return ret;
	}
}

module.exports = LoadedAsset;
