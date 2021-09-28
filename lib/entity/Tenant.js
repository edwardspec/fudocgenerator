'use strict';

const { CargoRow } = require( '..' ),
	{ capitalCase } = require( 'change-case' );

/**
 * Represents one tenant in the TenantDatabase.
 */
class Tenant {
	/**
	 * @param {Object} rawData Structure that describes this tenant.
	 */
	constructor( rawData ) {
		Object.assign( this, rawData );

		this.tenantCode = this.name;
		this.displayName = capitalCase( this.name );
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 *
	 * @return {string}
	 */
	getPartitionKey() {
		return 'tenant-' + this.tenantCode;
	}

	/**
	 * Get a human-readable description of which colony tags are needed to summon this tenant.
	 *
	 * @return {string}
	 */
	getTagsWikitext() {
		var requirements = [];
		for ( var [ colonyTag, quantity ] of Object.entries( this.colonyTagCriteria ) ) {
			requirements.push( '[[:Category:ColonyTag:' + colonyTag + '|' + colonyTag + ']] (' + quantity + ')' );
		}

		return requirements.join( ', ' );
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this Region into the Cargo database.
	 *
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		return new CargoRow( 'tenant', {
			id: this.tenantCode,
			name: this.displayName,
			tags: Object.keys( this.colonyTagCriteria ),
			tagsWikitext: this.getTagsWikitext()
		} );
	}
}

module.exports = Tenant;
