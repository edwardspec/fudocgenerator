'use strict';

const { CargoRow, util } = require( '..' );

/**
 * Represents one armor set in the ArmorSetDatabase.
 */
class ArmorSet {
	/**
	 * @param {string} id Arbitrary ID that is the same for all items in this set.
	 */
	constructor( id ) {
		this.id = id;
		this.initialized = false; // Will happen when the first item gets added
	}

	/**
	 * Add new head/chest/leg armor to this ArmorSet.
	 *
	 * @param {Item} item
	 * @param {string} slot Either "head", or "armor", or "legs".
	 */
	addItem( item, slot ) {
		if ( !this.initialized ) {
			this.initialized = true;

			// Note: if description doesn't have the string "Set Bonuses", then we show the whole description,
			// because some items list their bonuses as vague text rather than a designated list,
			// and this text can still contain important clues.
			this.bonus = util.cleanDescription( item.description ).split( /Set Bonuses:\s*/ ).pop();

			this.tier = item.level;
			this.rarity = item.rarity;

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

		var isAlternatePiece = true;
		if ( !this[slot] ) {
			this[slot] = [];
			isAlternatePiece = false;
		}
		this[slot].push( item );

		// When calculating "total price/stats of the entire set", we add helmet/chest/legs armor once.
		// If we discovered a second helm that fits the same set, then we don't add anything to totals,
		// because this is already accounted for. (most alternate helmets have the same stat/price,
		// and only differ in appearance)
		if ( !isAlternatePiece ) {
			this.price += item.price;
			for ( var [ stat, value ] of Object.entries( item.stats ) ) {
				if ( this.stats[stat] === undefined ) {
					util.log( '[warning] ArmorSet[' + this.id + ']: ignoring unknown stat=' + stat );
					continue;
				}

				this.stats[stat] += value;
			}
		}
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'set-' + this.id;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this ArmorSet into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		if ( !this.initialized ) {
			// Sanity check: addItem() must be called before toCargoDatabase().
			throw new Error( "ArmorSet doesn't contain any items: " + this.id );
		}

		var fields = {
			id: this.id,
			tier: this.tier,
			rarity: this.rarity,
			price: this.price,
			setBonus: this.bonus
		};

		if ( this.head ) {
			fields.head = this.head.map( ( item ) => item.itemCode );
			fields.headPage = this.head.map( ( item ) => item.wikiPageName );
		}
		if ( this.chest ) {
			fields.chest = this.chest.map( ( item ) => item.itemCode );
			fields.chestPage = this.chest.map( ( item ) => item.wikiPageName );
		}
		if ( this.legs ) {
			fields.legs = this.legs.map( ( item ) => item.itemCode );
			fields.legsPage = this.legs.map( ( item ) => item.wikiPageName );
		}

		for ( var [ stat, value ] of Object.entries( this.stats ) ) {
			var fieldName = stat;
			if ( stat == 'powerMultiplier' ) {
				fieldName = 'damage';
			} else if ( stat == 'maxHealth' ) {
				fieldName = 'health';
			} else if ( stat == 'maxEnergy' ) {
				fieldName = 'energy';
			} else {
				fieldName = stat.replace( /Resistance$/, '' );
			}

			fields[fieldName] = util.trimFloatNumber( value, 2 );
		}

		return new CargoRow( 'armorset', fields );
	}
}

module.exports = ArmorSet;
