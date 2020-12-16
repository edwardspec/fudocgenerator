'use strict';

const { ItemDatabase, RecipeSide, CargoRow, util } = require( '..' );

/**
 * Represents one node in the ResearchTree.
 */
class ResearchNode {
	/**
	 * @param {object} rawData Structure from the JSON asset of ResearchTree that describes this node.
	 * @param {string} nodeId Unique machine-readable ID of this node, e.g. "geology:metals_tungsten".
	 * @param {string} treeName Human-readable name of the ResearchTree.
	 * @param {string} nodeName Human-readable name of the node.
	 * @param {string} description Human-readable description of the node.
	 */
	constructor( rawData, nodeId, treeName, nodeName, description ) {
		// Remove color codes, etc.
		this.name = util.cleanDescription( nodeName );
		this.description = util.cleanDescription( description );

		// Convert rawData.price into the same format as inputs/outputs expected by Recipe class.
		this.price = new RecipeSide();
		( rawData.price || [] ).forEach( ( priceComponent ) => {
			var [ itemCode, count ] = priceComponent;
			this.price.addItem( itemCode, { count: count } );
		} );

		// Remember other information about the node.
		this.tree = treeName;
		this.id = nodeId;
		this.unlocks = rawData.unlocks || [];
		this.children = rawData.children || [];
		this.icon = rawData.icon;
		this.wikiPageLink = '{{ResearchNodeLink|' + treeName + '|' + nodeName + '|' + nodeId.replace( ':', '.' ) + '}}';

		// Parents of this node are not yet known, but can be determined later (in ResearchTreeDatabase).
		this.parents = [];
	}

	/**
	 * Get partition key (arbitrary string). This value shouldn't be based on fields that change often.
	 * @return {string}
	 */
	getPartitionKey() {
		return 'node-' + this.id.split( ':' ).pop();
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this ResearchNode into the Cargo database.
	 * @return {CargoRow}
	 */
	toCargoDatabase() {
		// Escape any "|" symbols in priceWikitext field.
		var priceWikitext = this.price.toWikitext().replace( /\|/g, '{{!}}' );

		var unlocksWikitext = this.unlocks.map( ( itemCode ) => {
			var itemName = ItemDatabase.getDisplayName( itemCode );
			if ( !itemName ) {
				util.warnAboutUnknownItem( itemCode );
				return false;
			}

			return '[[' + itemName + ']]';
		} ).filter( ( x ) => x !== false ).join( ', ' );

		var { ResearchTreeDatabase } = require( '..' ),
			childrenWikitext = ResearchTreeDatabase.nodeListToWikitext( this.tree, this.children ),
			parentsWikitext = ResearchTreeDatabase.nodeListToWikitext( this.tree, this.parents );

		return new CargoRow( 'research_node', {
			tree: this.tree,
			id: this.id,
			name: this.name,
			description: this.description,
			unlocks: this.unlocks,
			unlocksWikitext: unlocksWikitext,
			children: this.children,
			childrenWikitext: childrenWikitext,
			parents: this.parents,
			parentsWikitext: parentsWikitext,
			priceWikitext: priceWikitext,
			wikiPageLink: this.wikiPageLink
		} );
	}
}

module.exports = ResearchNode;
