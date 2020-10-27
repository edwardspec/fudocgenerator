/**
 * Discovers all nodes of Research Trees.
 */

'use strict';

const { config, AssetDatabase, ResearchNode, util } = require( '.' );

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
		this.addPseudoNodeWithBlueprints(
			'default',
			'Default unlocks', // Human-readable: becomes "Unlocked by: Default unlocks".
			AssetDatabase.get( '/player.config' ).data.defaultBlueprints
		)

		// Also add race-specific default unlocks, e.g. "Peglaci Flag" for Peglaci.
		// Note: we only do this for species from FU+vanilla. We are not documenting races from third-party mods.
		var supportedSpecies = AssetDatabase.get( '/interface/windowconfig/charcreation.config' ).data.speciesOrdering;
		supportedSpecies.forEach( ( id ) => {
			var asset = AssetDatabase.get( '/species/' + id + '.species' );
			if ( !asset ) {
				// Novakid JSON has some kind of parsing error. We are tolerant to bad input, so skip it for now.
				return;
			}

			var species = asset.data;
			this.addPseudoNodeWithBlueprints(
				'default-' + id,
				'Default unlocks (' + species.charCreationTooltip.title + '-specific)',
				species.defaultBlueprints
			);
		} );
	}

	/**
	 * Add several pseudo-nodes to the tree with Default unlocks. This is used by loadDefaultUnlocks().
	 * @param {string} nodeId Machine-readable ID of the pseudo-node, e.g. "default-peglaci".
	 * @param {string} nodeName Human-readable name of the pseudo-node, e.g. "Default unlocks".
	 * @param {object} Structure "defaultBlueprints" from assets like player.config or floran.species.
	 */
	addPseudoNodeWithBlueprints( nodeId, nodeName, defaultBlueprints ) {
		var treeName = 'No', // <-- This becomes "No tree", because "tree" suffix is appended to all trees.
			unlocks = [];

		for ( var blueprints of Object.values( defaultBlueprints ) ) {
			blueprints.forEach( ( element ) => unlocks.push( element.item ) );
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
