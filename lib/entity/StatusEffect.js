'use strict';

const { CargoRow, RemoveBadSymbols, util } = require( '..' );

/**
 * Represents one status effect in the StatusEffectDatabase.
 */
class StatusEffect {
	/**
	 * @param {Object} rawData Structure that describes this status effect.
	 */
	constructor( rawData ) {
		Object.assign( this, rawData );

		if ( this.label ) {
			this.label = RemoveBadSymbols.fromName( this.label );
		}
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'status-' + this.name;
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this StatusEffect into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		var fields = {
			id: this.name,
			name: this.label,
			defaultDuration: this.defaultDuration
		};
		if ( this.icon ) {
			fields.hasIcon = true;
		}

		if ( this.effectConfig ) {
			let { immunityStats, resistanceTypes, resistanceThreshold } = this.effectConfig;
			fields.immunityStats = immunityStats;

			if ( resistanceTypes && resistanceThreshold ) {
				let resistanceOptions = []; // Human-readable, e.g. "40% Cold".
				for ( let [ type, efficiency ] of Object.entries( resistanceTypes ) ) {
					if ( efficiency <= 0 ) {
						util.log( '[error] Incorrect efficiency in resistanceTypes: statuseffect=' + this.name );
						continue;
					}

					let percent = Math.round( 100 * resistanceThreshold / efficiency );
					let humanReadableType = util.ucfirst( type.replace( /Resistance$/, '' ) );

					resistanceOptions.push( percent + '% ' + humanReadableType );
				}

				fields.resistWith = resistanceOptions.join( ' OR ' );
			}
		}

		return new CargoRow( 'statuseffect', fields );
	}
}

module.exports = StatusEffect;
