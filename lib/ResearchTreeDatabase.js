/**
 * Discovers all nodes of Research Trees.
 */

const { AssetDatabase, ResearchNode, util } = require( '.' ),
	config = require( '../config' );

class ResearchTreeDatabase {
	constructor() {
		this.loaded = false;

		// Array of known research nodes,
		// e.g. [ { tree: 'Geology', id: 'metals_tier1', name: 'Geology I', unlocks: [ ... ], ... }, ... ]
		this.knownNodes = [];

		// Nodes grouped by tree, and in key-value form with nodeId as key,
		// e.g. { "Geology": { "metal_tier1": { ... }, ... }, ... }
		this.knownNodesByTree = {};
	}

	/**
	 * Scan the AssetDatabase and find all research trees.
	 */
	load() {
		AssetDatabase.forEach( 'config', ( filename, asset ) => {
			if ( !asset.data.researchTree ) {
				// Not a Research Tree.
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
				this.knownNodesByTree[treeName] = {};

				// Track parents of each node:
				// { childNodeId1: { parentNodeId1, parentNodeId2, ... }, ... }
				var parents = {};

				for ( var [ nodeId, rawNodeData ] of Object.entries( nodes ) ) {
					var [ nodeName, description ] = strings.research[nodeId];
					if ( !nodeName ) {
						util.log( '[error] Research node ' + nodeId + ' (' + treeName + ' tree) doesn\'t have a human-readable name.' );
						continue;
					}

					var node = new ResearchNode( rawNodeData, treeName, nodeId, nodeName, description );

					this.knownNodes.push( node );
					this.knownNodesByTree[treeName][nodeId] = node;

					// Remember this node as parent of all node.children.
					node.children.forEach( ( childNodeId ) => {
						if ( !parents[childNodeId] ) {
							parents[childNodeId] = [];
						}

						parents[childNodeId].push( nodeId );
					} );
				}

				// Add "parents" key to each node.
				for ( var [ childNodeId, parentNodes ] of Object.entries( parents ) ) {
					this.knownNodesByTree[treeName][childNodeId].parents = parentNodes;
				}
			}
		} );

		// Also add a pseudo-tree that shows all default unlocks.
		this.loadDefaultUnlocks();

		util.log( '[info] Loaded research nodes (' + this.knownNodes.length + ').' );

		this.loaded = true;
	}

	/**
	 * Add a pseudo-tree that contains "Default unlocks" node (to list the items unlocked by default).
	 * This is for items like Torch, Campfire, etc. (they don't need to be researched)
	 */
	loadDefaultUnlocks() {
		var treeName = 'No', // <-- This becomes "No tree", because "tree" suffix is appended to all trees.
			nodeId = 'default',
			nodeName = 'Default unlocks', // Human-readable: becomes "Unlocked by: Default unlocks".
			unlocks = [],
			playerConf = AssetDatabase.get( '/player.config' ).data;

		for ( var defaultBlueprints of Object.values( playerConf.defaultBlueprints ) ) {
			defaultBlueprints.forEach( ( element ) => unlocks.push( element.item ) );
		}

		var defaultNode = new ResearchNode(
			{ unlocks: unlocks }, treeName, nodeId, nodeName,
			"These items are unlocked by default. They don't need to be researched via the Research Tree."
		);
		this.knownNodes.push( defaultNode );

		this.knownNodesByTree[treeName] = {};
		this.knownNodesByTree[treeName][nodeId] = defaultNode;
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

	/**
	 * Get the node by human-readable tree name (e.g. "Geology") and node ID (e.g. "").
	 * @return {object}
	 */
	find( treeName, nodeId ) {
		return this.knownNodesByTree[treeName][nodeId];
	}

	/**
	* Get wikitext representation of the list of Research Tree nodes.
	* @param {string} treeName Human-readable tree name, e.g. "Geology".
	* @param {string[]} nodeIdsArray Array of node IDs, e.g. [ "psionics2", "cosmic2" ].
	* @return {string}
	*/
	nodeListToWikitext( treeName, nodeIdsArray ) {
		return nodeIdsArray.map( ( nodeId ) => {
			var node = this.knownNodesByTree[treeName][nodeId];
			if ( !node ) {
				util.log( '[error] Unknown node: ' + nodeId + ' (' + treeName + ' tree)' );
				return false;
			}

			return node.wikiPageLink;
		} ).filter( ( x ) => x !== false ).join( ', ' );
	}
}

module.exports = new ResearchTreeDatabase();
