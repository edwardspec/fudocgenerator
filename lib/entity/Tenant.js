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
	 * Get a wikitext link to this tenant's information.
	 *
	 * @return {string}
	 */
	getWikiPageLink() {
		// Tenants don't have separate pages, so we don't use EntityWithPageName.
		return '[[List of tenants#' + this.displayName + '|' + this.displayName + ']]';
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
			tagsWikitext: this.getTagsWikitext(),
			rentPool: this.rent.pool
		} );
	}
}

module.exports = Tenant;
