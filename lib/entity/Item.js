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
		// It's possible to use config.json to override wikipage titles of some items,
		// and some articles will be automatically renamed during ItemDatabase.load().
		this.wikiPageName = util.cleanPageName( config.overrideItemPageTitles[this.itemCode] || this.displayName );

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

		// Find stages, if any (for multi-stage buildings like Matter Assembler),
		// and if found, create Item objects for each of them.
		// These pseudo-items have ID "<id_of_main_item>:2", where 2 is tier (starting from 1).
		this.upgradedItems = ( this.upgradeStages || [] ).map( ( stageInfo, index ) => {
			// Parameters from "stageInfo" structure are added to the base parameters of the parent item.
			// Additionally, stageInfo.itemSpawnParameters can change things like item.shortdescription.
			var subitemData = {};
			for ( var dataSource of [ this, stageInfo, stageInfo.itemSpawnParameters ] ) {
				for ( var [ key, value ] of Object.entries( dataSource ) ) {
					if ( key !== 'upgradeStages' && key !== 'stageInfo' && key !== 'itemSpawnParameters' ) {
						subitemData[key] = value;
					}
				}
			}

			// Some stations (such as Armory) modify the UI directly and override shortdescription.
			// In these cases we'll use UI-displayed name, because it's what the player sees most of the time.
			// (the only time when shortdescription is shown if when the user moves the building into inventory)
			var interactData = subitemData.interactData;
			if ( interactData ) {
				var layout = interactData.paneLayoutOverride;
				if ( layout && layout.windowtitle ) {
					subitemData.shortdescription = layout.windowtitle.title;
				}
			}

			// FIXME: it's silly that Item() constructor requires an asset,
			// we should instead check both vanilla and the mod for the image with this.inventoryIcon as filename.
			var subAsset = {
				data: subitemData,
				vanilla: asset.vanilla,
				absolutePath: asset.absolutePath
			};
			var subitem = new Item( subAsset );
			subitem.itemCode = this.itemCode + ':' + ( this.startingUpgradeStage + index );

			return subitem;
		} );
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
