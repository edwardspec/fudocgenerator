'use strict';

const { util } = require( '..' );

/**
 * Represents one armor set in the ArmorSetDatabase.
 */
class ArmorSet {
	/**
	 * @param {string} code Arbitrary ID that is the same for all items in this set.
	 */
	constructor( id ) {
		this.id = id;
		this.initialized = false; // Will happen when the first item gets added
	}

	/**
	 * Add new head/chest/leg armor to this ArmorSet.
	 * @param {Item} item
	 * @param {string} slot Either "head", or "armor", or "legs".
	 */
	addItem( item, slot ) {
		if ( !this.initialized ) {
			this.initialized = true;

			this.tier = item.level;
			this.rarity = item.rarity;
			this.bonus = util.cleanDescription( item.description ).split( /Set Bonuses:\s*/ ).pop();

			this.price = 0;
			this.stats = {
				powerMultiplier: 0,
				protection: 0,
				maxEnergy: 0,
				maxHealth: 0,
				physicalResistance: 0,
				radioactiveResistance: 0,
				poisonResistance: 0,
				electricResistance: 0,
				fireResistance: 0,
				iceResistance: 0,
				cosmicResistance: 0,
				shadowResistance: 0
			};
		}

		this.price += item.price;
		for ( var [ stat, value ] of Object.entries( item.stats ) ) {
			if ( this.stats[stat] === undefined ) {
				util.log( '[warning] ArmorSet[' + this.id + ']: ignoring unknown stat=' + stat );
				continue;
			}

			this.stats[stat] += value;
		}

		this[slot] = item;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this ArmorSet into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		if ( !this.initialized ) {
			// Sanity check: addItem() must be called before toCargoDatabase().
			throw new Error( "ArmorSet doesn't contain any items: " + this.id );
		}

		var wikitext = '{{#cargo_store:_table = armorset\n';

		wikitext += '|id=' + this.id + '\n';

		if ( this.tier ) {
			wikitext += '|tier=' + this.tier + '\n';
		}

		if ( this.rarity ) {
			wikitext += '|rarity=' + this.rarity + '\n';
		}

		wikitext += '|price=' + this.price + '\n';
		wikitext += '|setBonus=' + this.bonus + '\n';

		if ( this.head ) {
			wikitext += '|head=' + this.head.itemCode + '\n';
			wikitext += '|headPage=' + this.head.wikiPageName + '\n';
		}

		if ( this.chest ) {
			wikitext += '|chest=' + this.chest.itemCode + '\n';
			wikitext += '|chestPage=' + this.chest.wikiPageName + '\n';
		}

		if ( this.legs ) {
			wikitext += '|legs=' + this.legs.itemCode + '\n';
			wikitext += '|legsPage=' + this.legs.wikiPageName + '\n';
		}

		for ( var [ stat, value ] of Object.entries( this.stats ) ) {
			var fieldName = stat;
			if ( stat == 'powerMultiplier' ) {
				fieldName = 'damage';
			} else if ( stat == 'maxHealth' ) {
				fieldName = 'health'
			} else if ( stat == 'maxEnergy' ) {
				fieldName = 'energy'
			} else {
				fieldName = stat.replace( /Resistance$/, '' );
			}

			wikitext += '|' + fieldName + '=' + value + '\n';
		}

		wikitext += '}} ';

		return wikitext;
	}
}

module.exports = ArmorSet;
