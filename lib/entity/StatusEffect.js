'use strict';

const { CargoRow, util } = require( '..' );

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
			this.label = util.cleanDescription( this.label );
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

		return new CargoRow( 'statuseffect', fields );
	}
}

module.exports = StatusEffect;
