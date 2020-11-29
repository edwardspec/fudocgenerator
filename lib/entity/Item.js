'use strict';

const { Query, WeaponAbilityDatabase, config, util } = require( '..' );

/**
 * Represents one item from the ItemDatabase.
 */
class Item {
	/**
	 * @param {LoadedAsset} asset Results of AssetDatabase.get() for the asset that describes this item.
	 */
	constructor( asset ) {
		this.asset = asset;

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

		// Default price is 0.
		if ( !this.price ) {
			this.price = 0;
		}

		// Determine if this is buildscript-generated Armor or Weapon.
		// Their "price" is "base price for Tier 1", it must be increased depending on their Tier.
		if ( this.builder && this.level !== undefined &&
			this.builder.match( /\/(fubuildarmor|buildunrandweapon|buildwhip)\.lua$/ )
		) {
			this.hasBuildscript = true;
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

		// Some items have primaryAbilityType/altAbilityType (string) instead of the inline structure.
		// They refer to the contents of *.weaponability asset. We need to use those assets too.
		// NOTE: unlike in Starbound, if both primaryAbilityType and primaryAbility (structure) exist,
		// we won't merge them, because we are not interested in copying "name: Broadsword Slash" or
		// "comboSteps: 3" to documentation of all broadswords (they are the same, it will unnecessarily
		// increase the size of Cargo database). Unique broadswords would have their unique parameters
		// in the inline structure "primaryAbility", so if it exists, we ignore *.weaponability asset.
		if ( Object.keys( this.primaryAbility || {} ).length == 0 && this.primaryAbilityType ) {
			this.primaryAbility = WeaponAbilityDatabase.find( this.primaryAbilityType );
		}
		if ( Object.keys( this.altAbility || {} ).length == 0 && this.altAbilityType ) {
			this.altAbility = WeaponAbilityDatabase.find( this.altAbilityType );
		}

		// Setting comboSteps and fireTime is allowed both in top-level structure of Item
		// and within its primaryAbility. To simplify things, let's add these keys into primaryAbility.
		if ( this.comboSteps && this.primaryAbility ) {
			this.primaryAbility.comboSteps = this.comboSteps;
		}

		if ( this.fireTime && this.primaryAbility ) {
			this.primaryAbility.fireTime = this.fireTime;
		}

		// Some crafting stations (such as Esoteric Research) unlock recipes when built.
		// To simplify things, we just add these unlocks to this.learnBlueprintsOnPickup array.
		if ( this.interactData && this.interactData.initialRecipeUnlocks ) {
			var blueprints = ( this.learnBlueprintsOnPickup || [] )
				.concat( this.interactData.initialRecipeUnlocks );

			// Make unique.
			this.learnBlueprintsOnPickup = [...new Set( blueprints )];
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

		if ( this.learnBlueprintsOnPickup ) {
			// Track "which items are unlocked when finding this item".
			// Some items (such as natural decorative blocks or hidden items) are not in the Research Tree.
			var unlocks = [];
			const { ItemDatabase } = require( '..' ); // To check "does item exist". FIXME: add proxy class that can be require()d on top of Item.js

			this.learnBlueprintsOnPickup.forEach( ( unlockedItemCode ) => {
				if ( !ItemDatabase.find( unlockedItemCode ) ) {
					util.log( "[warning] Item " + this.itemCode + " unlocks " + unlockedItemCode + ", but such item doesn't exist." );
					return;
				}

				unlocks.push( unlockedItemCode );
			} );

			if ( unlocks.length ) {
				wikitext += '|unlocks=' + unlocks.join( ',' ) + '\n';
			}
		}

		wikitext += '}} ';

		// Write key-value pairs of metadata into a separate Cargo table.
		for ( var [ key, value ] of Object.entries( this.getMetadata() ) ) {
			wikitext += '{{#cargo_store:_table = item_metadata\n';
			wikitext += '|id=' + this.itemCode
			wikitext += '|prop=' + key
			wikitext += '|value=' + value
			wikitext += '}} ';
		}

		return wikitext;
	}

	/**
	 * Gather metadata (parameters like foodValue, which only make sense for some items and
	 * don't have a column in "item" table) - these values are written into "item_metadata" table.
	 * @return {Object} Key-value map (string => string).
	 */
	getMetadata() {
		var metadata = {};
		if ( this.foodValue ) {
			metadata.foodValue = this.foodValue;
		}

		var whichAnimalsEat = Query.whichAnimalsEat( this.itemCode );
		if ( whichAnimalsEat ) {
			metadata.whichAnimalsEat = whichAnimalsEat;
		}

		if ( this.elementalType ) {
			metadata.damageType = this.elementalType;
		}

		// For buildscript-constructed weapons, their base damage is "damage at tier 1",
		// so we need to increase it depending on their starting tier.
		var damageMultiplier = this.hasBuildscript ? ( 0.5 + this.level / 2 ) : 1;

		// Add damage, elemental type, etc. of left-click and right-click attacks.
		if ( this.primaryAbility ) {
			Object.assign( metadata, util.getAttackMetadata( this.primaryAbility, '', damageMultiplier ) );
		}

		if ( this.altAbility ) {
			Object.assign( metadata, util.getAttackMetadata( this.altAbility, 'alt.', damageMultiplier ) );
		}

		// Size of containers
		if ( this.slotCount ) {
			metadata.slotCount = this.slotCount;
		}

		return metadata;
	}

	/**
	 * Make MediaWiki link: either [[NameOfItem]] or [[NameOfPage|NameOfItem]] (if they are named differently).
	 */
	getWikiPageLink() {
		var wikitext = '[[';
		if ( this.displayName != this.wikiPageName ) {
			wikitext += this.wikiPageName + '|';
		}
		wikitext += this.displayName + ']]';

		return wikitext;
	}
}

module.exports = Item;
