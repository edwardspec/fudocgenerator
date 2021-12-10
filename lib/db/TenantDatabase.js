'use strict';

const { AssetDatabase, Tenant, util } = require( '.' );

/**
 * Discovers all known tenants.
 */
class TenantDatabase {
	constructor() {
		this.loaded = false;

		// Array of known tenants: { "chef_mantizi": { ... }, ... }
		this.knownTenants = new Map();
	}

	/**
	 * Scan the AssetDatabase and find all tenants.
	 */
	load() {
		AssetDatabase.forEach( 'tenant', ( filename, asset ) => {
			var tenant = new Tenant( asset.data );
			this.knownTenants.set( tenant.name, tenant );
		} );

		util.log( '[info] TenantDatabase: found ' + this.knownTenants.size + ' tenants.' );
		this.loaded = true;
	}

	/**
	 * Find the tenant called "tenantCode" in the database.
	 *
	 * @param {string} tenantCode E.g. "chef_mantizi".
	 * @return {Tenant|null} Arbitrary information about this tenant.
	 */
	find( tenantCode ) {
		if ( !this.loaded ) {
			this.load();
		}

		return this.knownTenants.get( tenantCode );
	}

	/**
	 * Callback expected by TenantDatabase.forEach().
	 *
	 * @callback tenantCallback
	 * @param {Tenant} tenant
	 */

	/**
	 * Iterate over all tenant types. Run the callback for each of them.
	 * Callback receives 1 parameter (Tenant object).
	 *
	 * @param {biomeCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		for ( var tenant of this.knownTenants.values() ) {
			callback( tenant );
		}
	}
}

module.exports = new TenantDatabase();
