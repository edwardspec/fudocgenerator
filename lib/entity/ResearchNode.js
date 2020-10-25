'use strict';

const ItemDatabase = require( '../ItemDatabase' ),
	util = require( '../util' );

/**
 * Represents one node in the ResearchTree.
 */
class ResearchNode {
	/**
	 * @param {object} rawData Structure from the JSON asset of ResearchTree that describes this node.
	 * @param {string} treeName Human-readable name of the ResearchTree.
	 * @param {string} nodeId Machine-readable ID of this node.
	 * @param {string} nodeName Human-readable name of the node.
	 * @param {string} description Human-readable description of the node.
	 */
	constructor( rawData, treeName, nodeId, nodeName, description ) {
		// Remove color codes, etc.
		this.name = util.cleanDescription( nodeName );
		this.description = util.cleanDescription( description );

		// Convert rawData.price into the same format as inputs/outputs expected by Recipe class.
		this.price = {};
		( rawData.price || [] ).forEach( ( priceComponent ) => {
			var [ itemCode, count ] = priceComponent;
			this.price[itemCode] = { count: count }
		} );

		// Remember other information about the node.
		this.tree = treeName;
		this.id = nodeId;
		this.unlocks = rawData.unlocks || [];
		this.children = rawData.children || [];
		this.icon = rawData.icon;
		this.wikiPageLink = '{{ResearchNodeLink|' + treeName + '|' + nodeName + '}}';

		// Parents of this node are not yet known, but can be determined later (in ResearchTreeDatabase).
		this.parents = [];
	}

	/**
	 * Get a list of #cargo_store directives necessary to write this ResearchNode into the Cargo database.
	 * @return {string}
	 */
	toCargoDatabase() {
		var wikitext = '{{#cargo_store:_table = research_node\n';

		// Escape any "|" symbols in priceWikitext field.
		var priceWikitext = util.ingredientsListToWikitext( this.price ).replace( /\|/g, '{{!}}' );

		var unlocksWikitext = this.unlocks.map( ( itemCode ) => {
			var itemName = ItemDatabase.getDisplayName( itemCode );
			if ( !itemName ) {
				util.warnAboutUnknownItem( itemCode );
				return false;
			}

			return '[[' + itemName + ']]';
		} ).filter( ( x ) => x !== false ).join( ', ' );

		var childrenWikitext = util.researchNodeListToWikitext( this.tree, this.children ),
			parentsWikitext = util.researchNodeListToWikitext( this.tree, this.parents );

		wikitext += '|tree=' + this.tree + '\n';
		wikitext += '|id=' + this.id + '\n';
		wikitext += '|name=' + this.name + '\n';
		wikitext += '|description=' + this.description + '\n';
		wikitext += '|unlocks=' + this.unlocks.join( ',' ) + '\n';
		wikitext += '|unlocksWikitext=' + unlocksWikitext + '\n';
		wikitext += '|children=' + this.children.join( ',' ) + '\n';
		wikitext += '|childrenWikitext=' + childrenWikitext + '\n';
		wikitext += '|parents=' + this.parents.join( ',' ) + '\n';
		wikitext += '|parentsWikitext=' + parentsWikitext + '\n';
		wikitext += '|priceWikitext=' + priceWikitext + '\n';
		wikitext += '|wikiPageLink=' + this.wikiPageLink + '\n';
		wikitext += '}} ';

		return wikitext;
	}
}

module.exports = ResearchNode;
