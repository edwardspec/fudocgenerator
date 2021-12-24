'use strict';

const { CargoRow, EntityWithPageName, RemoveBadSymbols, util } = require( '..' );

/**
 * Represents one monster in the MonsterDatabase.
 */
class Monster {
	/**
	 * @param {Object} rawData Structure that describes this monster.
	 */
	constructor( rawData ) {
		Object.assign( this, rawData );
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'monster-' + this.type;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Monster into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		const fields = {
			id: this.type,
			name: this.displayName,
			wikiPage: this.wikiPageName,
			description: this.description ? RemoveBadSymbols.fromDescription( this.description ) : '',
			capturable: this.baseParameters.capturable ? 1 : 0
		};

		const touchDamage = this.baseParameters.touchDamage;
		if ( touchDamage ) {
			fields.damage = touchDamage.damage;
		}

		const statusSettings = this.baseParameters.statusSettings;
		if ( statusSettings ) {
			const stats = statusSettings.stats;
			if ( stats ) {
				if ( stats.maxHealth ) {
					fields.health = stats.maxHealth.baseValue;
				}

				// Note: we don't record stats that are 0 (protection, resistances), because 0 is the default.
				if ( stats.protection && stats.protection.baseValue ) {
					fields.protection = stats.protection.baseValue;
				}

				for ( const element of [ 'physical', 'radioactive', 'poison', 'electric', 'fire', 'ice', 'cosmic', 'shadow' ] ) {
					const resistanceStat = stats[element + 'Resistance'];
					if ( resistanceStat && resistanceStat.baseValue ) {
						fields[element] = util.ratioToPercent( resistanceStat.baseValue );
					}
				}
			}
		}
		return new CargoRow( 'monster', fields );
	}

	/**
	 * Returns true if this is a submonster of multi-segment monster, such as the tail of Burrower.
	 *
	 * @return {boolean}
	 */
	isSegment() {
		const params = this.baseParameters;
		return ( params.segmentMonster && params.segments < 1 );
	}

	/**
	 * Returns true if this is a passive critter (tiny non-hostile relocatable animal).
	 *
	 * @return {boolean}
	 */
	isCritter() {
		if ( this.baseParameters.buzzing ) {
			// Insect-like behavior, not used by full-size monsters.
			return true;
		}

		if ( this.type.includes( 'critter' ) ) {
			return true;
		}

		if ( this.baseParameters.behavior && this.baseParameters.behavior.includes( 'critter' ) ) {
			return true;
		}

		if ( this.getBugNetPool() ) {
			// Insects that are capturable with a Bug Net are otherwise not different from critters,
			// so we consider them critters.
			return true;
		}

		return false;
	}

	/**
	 * Returns name of TreasurePool that is yielded by Bug Net when this monster gets caught.
	 * Returns undefined if not capturable by Bug Net.
	 *
	 * @return {string|undefined}
	 */
	getBugNetPool() {
		return ( this.dropPools[0] || {} ).bugnet;
	}

	/**
	 * Get text of the MediaWiki article about this Monster.
	 *
	 * @return {string}
	 */
	toArticleText() {
		return '{{Automatic infobox monster|' + this.type + "}}<!-- Please don't delete this line -->\n" +
			'<!-- You can write the text below. -->\n\n\n' +
			'{{All recipes for monster|' + this.type + '}}' +
			"<!-- Please don't delete this line -->";
	}
}

util.addMixin( Monster, EntityWithPageName );
module.exports = Monster;
