'use strict';

const { config, util } = require( '..' ),
	fs = require( 'fs' ),
	path = require( 'path' );

/**
 * Represents one item from the ItemDatabase.
 */
class Item {
	/**
	 * @param {object} asset Results of AssetDatabase.get() for the asset that describes this item.
	 */
	constructor( asset ) {
		// Copy all key/value pairs from JSON asset into this Item object.
		Object.assign( this, asset.data );

		// Precalculate additional information about this item (such as item ID or display name).
		this.itemCode = this.itemName || this.objectName;

		// Remove the color codes from the description (e.g. "^#e43774;" or "^reset;" ).
		// Also remove "[FU]" from names of items like 'Kiri Fruit [FU]', because it's not needed
		// and because symbols "[" and "]" can't be in wikipage titles.
		// (this suffix means that another popular mod, but not vanilla, has an item with this name)
		this.displayName = util.cleanDescription( this.shortdescription || '' )
			.replace( /\s*\[FU\]\s*/, '' );

		// Name of MediaWiki article about this item.
		// For most items it'll be the same as displayName, except for situations when several items
		// have the same name (e.g. there are 4 flashlights, and they are all called "Flashlight").
		// Later (when such collision is detected) wikiPageName may be modified accordingly.
		this.wikiPageName = this.displayName;

		// Locate the icon, if any.
		// Currently we don't support extracting a part of combined image (e.g. "ironbeakegg.png:idle.1").
		var icon = this.inventoryIcon;
		if ( icon && typeof( icon ) === 'string' && !icon.match( ':' ) ) {
			// Find absolute path to the icon file.
			var iconPath;
			if ( icon[0] === '/' ) {
				iconPath = ( asset.vanilla ? config.pathToVanilla : config.pathToMod ) + '/' + icon;
			} else {
				iconPath = path.dirname( asset.absolutePath ) + '/' + icon;
			}

			if ( fs.existsSync( iconPath ) ) {
				this.inventoryIconPath = iconPath;
			} else {
				util.log( '[warning] Item ' + this.itemCode + ' refers to nonexistent inventoryIcon: ' + iconPath );
			}
		}

		// Default price is 0.
		if ( !this.price ) {
			this.price = 0;
		}

		// Determine if this is buildscript-generated Armor or Weapon.
		// Their "price" is "base price for Tier 1", it must be increased depending on their Tier.
		if ( this.builder && this.level !== undefined &&
			this.builder.match( /\/(fubuildarmor|buildunrandweapon)\.lua$/ )
		) {
			this.price *= ( 0.5 + this.level / 2 );
		}
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Item into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		var wikitext = '{{#cargo_store:_table = item\n';
		wikitext += '|id=' + this.itemCode + '\n';
		wikitext += '|name=' + this.displayName + '\n';
		wikitext += '|wikiPage=' + this.wikiPageName + '\n';

		// Most of these fields are optional, because we must be tolerant to bad input.
		if ( this.category ) {
			wikitext += '|category=' + util.cleanDescription( this.category ) + '\n';
		}

		if ( this.itemTags ) {
			wikitext += '|tags=' + this.itemTags.join( ',' ) + '\n';
		}

		if ( this.colonyTags ) {
			wikitext += '|colonyTags=' + this.colonyTags.join( ',' ) + '\n';
		}

		if ( this.description ) {
			wikitext += '|description=' + util.cleanDescription( this.description ) + '\n';
		}

		if ( this.rarity ) {
			wikitext += '|rarity=' + this.rarity + '\n';
		}

		wikitext += '|price=' + ( this.price || 0 ) + '\n';

		if ( this.maxStack ) {
			wikitext += '|stackSize=' + this.maxStack + '\n';
		}

		if ( this.level ) {
			wikitext += '|tier=' + this.level + '\n';
		}

		// TODO: what is the default if this parameter is not specified? Two-handed or one-handed?
		if ( this.twoHanded !== undefined ) {
			wikitext += '|twoHanded=' + ( this.twoHanded ? 1 : 0 ) + '\n';
		}

		var isUpgradeable = false;
		if ( Array.isArray( this.itemTags ) ) {
			if ( this.itemTags.indexOf( 'upgradeableWeapon' ) !== -1 ) {
				isUpgradeable = true;
			} else if ( this.itemTags.indexOf( 'upgradeableTool' ) !== -1 ) {
				isUpgradeable = true;
			}
		}

		wikitext += '|upgradeable=' + ( isUpgradeable ? 1 : 0 ) + '\n';
		wikitext += '}} ';

		return wikitext;
	}
}

module.exports = Item;
