/**
 * Discovers all nodes of Research Trees.
 */

const ItemDatabase = require( './ItemDatabase' ),
	AssetDatabase = require( './AssetDatabase' ),
	util = require( './util' ),
	config = require( '../config' );

class ResearchTreeDatabase {
	constructor() {
		this.loaded = false;

		// Array of known research nodes,
		// e.g. [ { tree: 'Geology', id: 'metals_tier1', name: 'Geology I', unlocks: [ ... ], ... }, ... ]
		this.knownNodes = [];
	}

	/**
	 * Scan the ItemDatabase and find all crafting stations.
	 */
	load() {
		AssetDatabase.forEach( ( filename, asset ) => {
			if ( asset.type !== 'config' || !asset.data.researchTree ) {
				// Not a config of a Research Tree.
				return;
			}

			var strings = asset.data.strings;

			// Here treeId is a machine-readable name (e.g. "fu_geology"),
			// while treeName is a human-readable name (e.g. "Geology"). Same for nodeId/nodeName.
			for ( var [ treeId, nodes ] of Object.entries( asset.data.researchTree ) ) {
				if ( !strings || !strings.trees || !strings.research ) {
					util.log( '[error] Research tree ' + filename + ' doesn\'t have any strings.' );
					continue;
				}

				var treeName = config.overrideResearchTreeName[treeId] || strings.trees[treeId];
				if ( !treeName ) {
					util.log( '[error] Research tree ' + filename + ' doesn\'t have a human-readable name.' );
					continue;
				}

				// Remove color codes, etc.
				treeName = util.cleanDescription( treeName );

				for ( var [ nodeId, node ] of Object.entries( nodes ) ) {
					var [ nodeName, description ] = strings.research[nodeId];
					if ( !nodeName ) {
						util.log( '[error] Research node ' + nodeId + ' (' + treeName + ' tree) doesn\'t have a human-readable name.' );
						continue;
					}

					// Remove color codes, etc.
					nodeName = util.cleanDescription( nodeName );

					// Convert node.price into the same format as inputs/outputs expected by Recipe class.
					var recipeInputs = {};
					node.price.forEach( ( priceComponent ) => {
						var [ itemCode, count ] = priceComponent;
						recipeInputs[itemCode] = { count: count }
					} )

					this.knownNodes.push( {
						tree: treeName,
						id: nodeId,
						name: nodeName,
						description: description,
						unlocks: node.unlocks,
						price: recipeInputs,
						icon: node.icon,
						wikiPageName: nodeName + ' (' + treeName + ' tree)'
					} );
				}
			}
		} );

		util.log( '[info] Loaded research nodes (' + this.knownNodes.length + ').' );

		this.loaded = true;
	}

	/**
	 * Iterate over all nodes. Run the callback for each of them.
	 * Callback receives 1 parameter: information about the node (key-value Object).
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		this.knownNodes.forEach( callback );
	}
}

module.exports = new ResearchTreeDatabase();
