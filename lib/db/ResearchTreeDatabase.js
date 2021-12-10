'use strict';

const { config, AssetDatabase, ResearchNode, RemoveBadSymbols, util } = require( '.' );

/**
 * Discovers all nodes of Research Trees.
 */
class ResearchTreeDatabase {
	constructor() {
		this.loaded = false;

		// Array of known research nodes,
		// e.g. { 'geology:metals_tier1': { tree: 'Geology', name: 'Geology I', unlocks: [ ... ], ... }, ...}
		this.knownNodes = new Map();

		// Nodes grouped by tree, and in key-value form with nodeId as key,
		// e.g. { "Geology": { "metal_tier1": { ... }, ... }, ... }
		this.knownNodesByTree = {};
	}

	/**
	 * Scan the AssetDatabase and find all research trees.
	 */
	load() {
		// Track parents of each node:
		// { childNodeId1: { parentNodeId1, parentNodeId2, ... }, ... }
		var parents = {};

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
				treeName = RemoveBadSymbols.fromName( treeName );
				this.knownNodesByTree[treeName] = {};

				for ( var [ nodeIdWithoutTree, rawNodeData ] of Object.entries( nodes ) ) {
					var [ nodeName, description ] = strings.research[nodeIdWithoutTree];
					if ( !nodeName ) {
						util.log( '[error] Research node ' + nodeIdWithoutTree + ' (' + treeName + ' tree) doesn\'t have a human-readable name.' );
						continue;
					}

					// To easily keep track of cross-tree requirements ("node A in tree 1 requires node B in tree 2"),
					// we join "treeId" and "internalNodeId" into one string, and pretend that this is a node ID.
					// This allows arrays like "parents" and "children" (arrays of node IDs) to list nodes from other trees.
					var nodeId = treeId + ':' + nodeIdWithoutTree;
					var node = new ResearchNode( rawNodeData, nodeId, treeName, nodeName, description );

					// Remember this node as parent of all node.children.
					node.children = node.children.map( ( childNodeIdWithoutTree ) => {
						var childNodeId = treeId + ':' + childNodeIdWithoutTree;

						if ( !parents[childNodeId] ) {
							parents[childNodeId] = [];
						}
						parents[childNodeId].push( nodeId );

						return childNodeId;
					} );

					this.knownNodes.set( nodeId, node );
					this.knownNodesByTree[treeName][nodeId] = node;
				}
			}

			// Add "parents" key to each node.
			for ( var [ childNodeId, parentNodes ] of Object.entries( parents ) ) {
				var childNode = this.knownNodes.get( childNodeId );
				childNode.parents = parentNodes;
			}
		} );

		// Also add a pseudo-tree that shows all default unlocks.
		this.loadDefaultUnlocks();

		util.log( '[info] ResearchTreeDatabase: found ' + this.knownNodes.size + ' research nodes.' );

		this.loaded = true;
	}

	/**
	 * Add a pseudo-tree that contains "Default unlocks" node (to list the items unlocked by default).
	 * This is for items like Torch, Campfire, etc. (they don't need to be researched)
	 */
	loadDefaultUnlocks() {
		this.addPseudoNodeWithBlueprints(
			'notree:default',
			'Default unlocks', // Human-readable: becomes "Unlocked by: Default unlocks".
			AssetDatabase.getData( '/player.config' ).defaultBlueprints
		);

		// Also add race-specific default unlocks, e.g. "Peglaci Flag" for Peglaci.
		// Note: we only do this for species from FU+vanilla. We are not documenting races from third-party mods.
		var supportedSpecies = AssetDatabase.getData( '/interface/windowconfig/charcreation.config' ).speciesOrdering;
		supportedSpecies.forEach( ( id ) => {
			var species = AssetDatabase.getData( '/species/' + id + '.species' );
			this.addPseudoNodeWithBlueprints(
				'notree:default-' + id,
				'Default unlocks (' + species.charCreationTooltip.title + '-specific)',
				species.defaultBlueprints
			);
		} );
	}

	/**
	 * Add several pseudo-nodes to the tree with Default unlocks. This is used by loadDefaultUnlocks().
	 *
	 * @param {string} nodeId Machine-readable ID of the pseudo-node, e.g. "default-peglaci".
	 * @param {string} nodeName Human-readable name of the pseudo-node, e.g. "Default unlocks".
	 * @param {Object} defaultBlueprints Structure "defaultBlueprints" from assets like player.config or floran.species.
	 */
	addPseudoNodeWithBlueprints( nodeId, nodeName, defaultBlueprints ) {
		var treeName = 'No', // <-- This becomes "No tree", because "tree" suffix is appended to all trees.
			unlocks = [];

		for ( var blueprints of Object.values( defaultBlueprints ) ) {
			blueprints.forEach( ( element ) => unlocks.push( element.item ) );
		}

		var defaultNode = new ResearchNode(
			{ unlocks: unlocks }, nodeId, treeName, nodeName,
			"These items are unlocked by default. They don't need to be researched via the Research Tree."
		);
		this.knownNodes.set( nodeId, defaultNode );

		this.knownNodesByTree[treeName] = {};
		this.knownNodesByTree[treeName][nodeId] = defaultNode;
	}

	/**
	 * Iterate over all nodes. Run the callback for each of them.
	 * Callback receives 1 parameter (ResearchNode object).
	 *
	 * @param {researchNodeCallback} callback
	 */
	forEach( callback ) {
		if ( !this.loaded ) {
			this.load();
		}

		this.knownNodes.forEach( callback );
	}

	/**
	 * Callback expected by ResearchTreeDatabase.forEach().
	 *
	 * @callback researchNodeCallback
	 * @param {ResearchNode} node
	 */

	/**
	 * Get the node by human-readable tree name (e.g. "Geology") and node ID (e.g. "metal_tier1").
	 *
	 * @param {string} treeName
	 * @param {string} nodeId
	 * @return {Object}
	 */
	find( treeName, nodeId ) {
		return this.knownNodesByTree[treeName][nodeId];
	}

	/**
	 * Get wikitext representation of the list of Research Tree nodes.
	 *
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
