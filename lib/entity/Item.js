'use strict';

const { LoadedAsset, Query, EntityWithPageName, FunctionsDatabase, MaterialDatabase,
		WeaponAbilityDatabase, CargoRow, util } = require( '..' ),
	deepmerge = require( 'deepmerge' );

/**
 * Represents one item from the ItemDatabase.
 */
class Item {
	/**
	 * @param {LoadedAsset} asset Results of AssetDatabase.get() for the asset that describes this item.
	 * @param {string} overrideId If not empty, item ID will be this string. Used for pseudo-items.
	 */
	constructor( asset, overrideId = '' ) {
		this.asset = asset;

		// Copy all key/value pairs from JSON asset into this Item object.
		Object.assign( this, asset.data );

		// Precalculate additional information about this item (such as item ID or display name).
		this.itemCode = overrideId || this.itemName || this.objectName;

		// Remove the color codes from the description (e.g. "^#e43774;" or "^reset;" ).
		// Also remove "[FU]" from names of items like 'Kiri Fruit [FU]', because it's not needed
		// and because symbols "[" and "]" can't be in wikipage titles.
		// (this suffix means that another popular mod, but not vanilla, has an item with this name)
		this.displayName = util.cleanDescription( this.shortdescription || '' )
			.replace( /\s*\[FU\]\s*/, '' );

		// Default price is 0.
		if ( !this.price ) {
			this.price = 0;
		}

		// Determine if this is buildscript-generated Armor or Weapon.
		// Their "price" is "base price for Tier 1", it must be increased depending on their Tier.
		if ( this.builder && this.level !== undefined &&
			this.builder.match( /\/(fubuildarmor|buildunrandweapon|buildwhip|fubuildmagnorb|buildboomerang|fubuildchakram|buildbow|neb-buildbow|buildfist)\.lua$/ )
		) {
			this.hasBuildscript = true;
			this.price *= FunctionsDatabase.calculate( 'itemLevelPriceMultiplier', this.level );
		}

		// Handle level-based armor bonuses to protection, health, energy, damage and resistances.
		// They should be multiplied by their leveling multiplier.
		this.stats = {};
		( this.leveledStatusEffects || [] ).forEach( ( leveledBonus ) => {
			var stat = leveledBonus.stat;

			var multiplier = FunctionsDatabase.calculate( leveledBonus.levelFunction, this.level || 1 );
			var value = ( leveledBonus.amount || 1 );
			if ( leveledBonus.baseMultiplier ) {
				// Typically used for damage. Example for tier 1 (multiplier=1) and tier 3 (multiplier=3):
				// if baseMultiplier=1.25, that means means +25% on tier 1 and +75% on tier 3.
				multiplier *= ( leveledBonus.baseMultiplier - 1 );
			}

			var scaledValue = util.trimFloatNumber( value * multiplier, 2 );
			if ( stat == 'powerMultiplier' || stat.match( /Resistance$/ ) ) {
				// Show damage bonus and resistances in percents (0.25 => 25%).
				scaledValue *= 100;
			}

			this.stats[stat] = scaledValue;
		} );

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

			// Item object needs to know its asset to locate the inventoryIcon, etc.
			var subAsset = LoadedAsset.newChildAsset( asset, subitemData );
			var pseudoId = this.itemCode + ':' + ( this.startingUpgradeStage + index );
			return new Item( subAsset, pseudoId );
		} );

		// Merge the first upgrade stage (if any) into the parent item,
		// so that there wouldn't be two separate items like "prototyper" and "prototyper:1".
		var firstStage = this.upgradedItems.shift();
		if ( firstStage ) {
			for ( var [ key, value ] of Object.entries( firstStage ) ) {
				// Even if first stage has "description" key, the game ignores it
				// and uses the description of the parent item.
				if ( key !== 'itemCode' && key !== 'upgradedItems' && key !== 'description' ) {
					this[key] = value;
				}
			}
		}

		// Some items have primaryAbilityType/altAbilityType (string) instead of the inline structure.
		// They refer to the contents of *.weaponability asset. We need to use those assets too.
		// Note that values from primaryAbility/altAbility have priority over values from ability.
		this.primaryAbility = this.mergeAbility( this.primaryAbility, this.primaryAbilityType );
		this.altAbility = this.mergeAbility( this.altAbility, this.altAbilityType );

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
	 * Create Item object from codex (book-like item that contains pages of text).
	 *
	 * @param {LoadedAsset} asset Results of AssetDatabase.get() for the asset of this codex.
	 * @return {Item}
	 */
	static newFromCodex( asset ) {
		var data = asset.data;

		// This modifies the original LoadedAsset in the AssetDatabase to make it a valid Item.
		data.itemName = data.id + '-codex';
		data.inventoryIcon = data.icon;
		data.category = 'codex';

		// We need extra cleanup for "shortdescription" field, because Codex can have bullets and/or
		// linebreaks in its title, and we can't have those in wikipage names.
		data.shortdescription = util.cleanPageName( data.title.replace( //g, '' ) )
			.replace( /[\r\n]+/g, ' ' ) + ' (codex)';

		// Some codexes are too long for vanilla Codex Viewer to display them properly, so they have
		// their text in "longContentPages" array instead (which is not used by vanilla Viewer).
		if ( data.longContentPages ) {
			data.contentPages = data.longContentPages;
		}

		// Codex will have parameters like "rarity" or "price" inside the "itemConfig" object.
		for ( var [ key, value ] of Object.entries( data.itemConfig || {} ) ) {
			data[key] = value;
		}

		return new Item( asset );
	}

	/**
	 * True if this item is a codex, false otherwise.
	 *
	 * @return {boolean}
	 */
	isCodex() {
		return this.contentPages !== undefined;
	}

	/**
	 * True if this item is a non-vanilla codex, false otherwise.
	 *
	 * @return {boolean}
	 */
	isNonVanillaCodex() {
		return !this.asset.vanilla && this.isCodex();
	}

	/**
	 * Properly merge: 1) Object like "this.primaryAbility",
	 * 2) contents of WeaponAbilityDatabase for the ability "this.primaryAbilityType".
	 * Both (1) and (2) are optional.
	 * Merging is necessary, because some items can have dps/fireRate in their .activeitem file,
	 * but the name of special ability in .weaponability file (or vise versa).
	 *
	 * @param {Object|undefined} inlineAbility
	 * @param {string|undefined} abilityType
	 * @return {Object|undefined}
	 */
	mergeAbility( inlineAbility, abilityType ) {
		if ( !inlineAbility && !abilityType ) {
			return undefined;
		}

		var result = inlineAbility || {};
		if ( !abilityType ) {
			return result;
		}

		var abilityConf = WeaponAbilityDatabase.find( abilityType );
		if ( !abilityConf ) {
			return result;
		}

		if ( !result.name ) {
			result.name = abilityConf.name;
		}

		var ability = abilityConf.ability || abilityConf;
		return deepmerge( ability, result );
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'item-' + this.itemCode;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Item into the Cargo database.
	 *
	 * @return {CargoRow[]}
	 */
	toCargoDatabase() {
		var fields = {
			id: this.itemCode,
			name: this.displayName,
			wikiPage: this.wikiPageName,
			// Most of these fields are optional, because we must be tolerant to bad input.
			category: this.category ? util.cleanDescription( this.category ) : '',
			tags: this.itemTags || [],
			colonyTags: this.colonyTags || [],
			description: this.description ? util.cleanDescription( this.description ) : '',
			rarity: this.rarity,
			price: this.price || 0,
			stackSize: this.maxStack,
			tier: this.level
		};

		if ( this.twoHanded !== undefined ) {
			fields.twoHanded = ( this.twoHanded ? 1 : 0 );
		}

		if ( Array.isArray( this.itemTags ) ) {
			if ( this.itemTags.indexOf( 'upgradeableWeapon' ) !== -1 ) {
				fields.upgradeable = 1;
			} else if ( this.itemTags.indexOf( 'upgradeableTool' ) !== -1 ) {
				fields.upgradeable = 1;
			}
		}

		if ( this.learnBlueprintsOnPickup ) {
			// Track "which items are unlocked when finding this item".
			// Some items (such as natural decorative blocks or hidden items) are not in the Research Tree.
			fields.unlocks = this.learnBlueprintsOnPickup.filter( ( unlockedItemCode ) => {
				if ( !Query.doesItemExist( unlockedItemCode ) ) {
					util.log( '[warning] Item ' + this.itemCode + ' unlocks ' + unlockedItemCode + ", but such item doesn't exist." );
					return false;
				}
				return true;
			} );
		}

		var cargoRows = [];
		cargoRows.push( new CargoRow( 'item', fields ) );

		// Write key-value pairs of metadata into a separate Cargo table.
		for ( var [ key, value ] of Object.entries( this.getMetadata() ) ) {
			cargoRows.push( new CargoRow( 'item_metadata', {
				id: this.itemCode,
				prop: key,
				value: util.escapeParameterOfCargoStore( value )
			}, { compact: true } ) );
		}

		// Codex texts are in a separate table (they are too long for value= field of "item_metadata" table).
		// Note: type of item_metadata.value field is String, while codex_text.text is Text.
		if ( this.contentPages ) {
			var codexText = util.cleanDescription( this.contentPages.join( '\n----\n' ) );

			cargoRows.push( new CargoRow( 'codex_text', {
				id: this.itemCode,
				text: util.escapeParameterOfCargoStore( codexText )
			}, { compact: true } ) );
		}

		return cargoRows;
	}

	/**
	 * Gather metadata (parameters like foodValue, which only make sense for some items and
	 * don't have a column in "item" table) - these values are written into "item_metadata" table.
	 *
	 * @return {Object} Key-value map (string => string).
	 */
	getMetadata() {
		var metadata = {};
		if ( this.foodValue ) {
			metadata.foodValue = this.foodValue;
		}

		if ( this.builder === '/items/buildscripts/buildfood.lua' ) {
			// Additionally gather "how much minutes before this food rots".
			// Note: we only remember non-default rotting times (default is 3h20m and rottingMultiplier=1)
			// to reduce the size of Cargo database.
			var agingScripts = this.itemAgingScripts;
			if ( agingScripts && agingScripts.includes( '/scripts/items/rotting.lua' ) ) {
				if ( this.rottingMultiplier && this.rottingMultiplier !== 1 ) {
					// Food with non-standard rotting multiplier.
					metadata.rotMinutes = 200 * this.rottingMultiplier;
				}
			} else {
				metadata.noRotting = 1;
			}
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
		var damageMultiplier = this.hasBuildscript ?
			FunctionsDatabase.calculate( 'weaponDamageLevelMultiplier', this.level || 1 ) : 1;

		// Add damage, elemental type, etc. of left-click and right-click attacks.
		var projectile = this.projectileConfig || this.projectileParameters; // For thrown weapons

		if ( this.primaryAbility ) {
			Object.assign( metadata, util.getAttackMetadata( this.primaryAbility, '', damageMultiplier ) );
		} else if ( projectile && projectile.power ) {
			// Calculate DPS and fireTime for Magnorbs, Boomerangs and other thrown weapons.
			// NOTE: although for items like Hunting Spear the resulting numbers are exactly correct,
			// items like Boomerangs can theoretically hit the same enemy many times during the same "firing".
			// Since we have no idea how many times it would happen (it depends on player's skill, etc.),
			// we show approximate damage based on assumption "enemy was hit only once per firing".
			var thrownAbility = {};

			thrownAbility.fireTime = ( this.windupTime || 0 ) +
				( this.cooldown || 0 ) +
				( this.orbitRate || 0 ) +
				( this.cooldownTime || 0 );

			if ( thrownAbility.fireTime ) {
				thrownAbility.baseDps = projectile.power / thrownAbility.fireTime;
			}

			Object.assign( metadata, util.getAttackMetadata( thrownAbility, '', damageMultiplier ) );
		}

		if ( this.altAbility ) {
			Object.assign( metadata, util.getAttackMetadata( this.altAbility, 'alt.', damageMultiplier ) );
		}

		// Bonuses to protection, health, energy and damage. They are already adjusted to the needed tier.
		for ( var [ stat, value ] of Object.entries( this.stats ) ) {
			// Other stats (especially elemental resistances) take too much space,
			// and they are less useful for 1 item (not a whole set), so they are in "armorset" table instead.
			if ( stat.match( /^(powerMultiplier|protection|maxHealth|maxEnergy)$/ ) ) {
				metadata[stat] = value;
			}
		}

		// Size of containers
		if ( this.slotCount ) {
			metadata.slotCount = this.slotCount;
		}

		// Block hitpoints (for knowing "how well does this block resist damaging weather")
		if ( this.materialId ) {
			var material = MaterialDatabase.find( this.materialId );
			if ( material.health ) {
				metadata.blockHealth = material.health;
			}
		}

		// Fuels: ship and mech.
		if ( this.fuelAmount ) {
			metadata.shipFuel = this.fuelAmount;
		}

		var mechFuel = Query.getMechFuelInfo( this.itemCode );
		if ( mechFuel ) {
			metadata.mechFuel = mechFuel.fuelMultiplier;
			metadata.mechFuelType = mechFuel.fuelType;
		}

		return metadata;
	}

	/**
	 * Get text of the MediaWiki article about this Item.
	 *
	 * @param {string} wikiPageName
	 * @return {string}
	 */
	toArticleText( wikiPageName ) {
		return '{{Automatic infobox item|' + this.itemCode + "}}<!-- Please don't delete this line -->\n" +
			'<!-- You can write the text below. -->\n\n\n' +
			'{{All recipes for item|id=' + this.itemCode + '|name=' + wikiPageName + '}}' +
			"<!-- Please don't delete this line -->";
	}
}

util.addMixin( Item, EntityWithPageName );
module.exports = Item;
