'use strict';

const { CargoRow } = require( '..' );

/**
 * Represents one monster in the MonsterDatabase.
 */
class Monster {
	/**
	 * @param {object} rawData Structure that describes this monster.
	 */
	constructor( rawData ) {
		Object.assign( this, rawData );
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 * @return {string}
	 */
	getPartitionKey() {
		return 'monster-' + this.type;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Monster into the Cargo database.
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		var fields = {
			id: this.type,
			name: this.displayName,
			description: this.description,
			capturable: this.baseParameters.capturable ? 1 : 0
		};

		var touchDamage = this.baseParameters.touchDamage;
		if ( touchDamage ) {
			fields.damage = touchDamage.damage;
		}

		var statusSettings = this.baseParameters.statusSettings;
		if ( statusSettings ) {
			var stats = statusSettings.stats;
			if ( stats ) {
				if ( stats.maxHealth ) {
					fields.health = stats.maxHealth.baseValue;
				}

				// Note: we don't record stats that are 0 (protection, resistances), because 0 is the default.
				if ( stats.protection && stats.protection.baseValue ) {
					fields.protection = stats.protection.baseValue;
				}

				for ( var element of [ 'physical', 'radioactive', 'poison', 'electric', 'fire', 'ice', 'cosmic', 'shadow' ] ) {
					var resistanceStat = stats[element + 'Resistance'];
					if ( resistanceStat && resistanceStat.baseValue ) {
						fields[element] = 100 * resistanceStat.baseValue;
					}
				}
			}
		}
		return new CargoRow( 'monster', fields );
	}
}

module.exports = Monster;
