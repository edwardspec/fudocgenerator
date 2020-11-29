local p = {}
local cargo = mw.ext.cargo

-- Implements {{Item unlocked by|ID of item}}, which calls {{#invoke: ItemUnlockedBy|Main}}
-- and shows "Unlocked by: [...research node 1...], [...research node 2...], [...item 3...], ...".
function p.Main( frame )
	local args = frame.args
	if not args[1] then
		-- If called from a template like {{Item unlocked by}} without parameters,
		-- use parameters of the parent template instead.
		args = frame:getParent().args
	end

	local id = args[1] or 'sugarcaneseed'

	-- Array of things that unlock this item.
	-- Each element is arbitrary wikitext.
	local whatUnlocksThis = {}

	-- Find research nodes that unlock this item
	-- by performing a SQL query to the Cargo database (see Special:CargoTables/research_node).
	local researchRows = cargo.query( 'research_node', 'tree,name,id', {
		where = 'unlocks HOLDS "' .. id .. '"',
		limit = 20
	} ) or {}

	for _, row in ipairs( researchRows ) do
		local normalizedId = string.gsub( row.id, ':', '.' )
		local link = frame:expandTemplate{ title = 'ResearchNodeLink', args = { row.tree, row.name, normalizedId } }
		table.insert( whatUnlocksThis, link )
	end

	-- Some blueprints are still unlocked not (only?) via the Research Tree, but by finding some item.
	-- Find all items that will unlock this item
	-- by performing a SQL query to the Cargo database (see Special:CargoTables/item).
	local pickupRows = cargo.query( 'item', 'name,wikiPage', {
		where = 'unlocks HOLDS "' .. id .. '"',
		limit = 20
	} ) or {}

	for _, row in ipairs( pickupRows ) do
		table.insert( whatUnlocksThis, 'finding \'\'[[' .. row.wikiPage .. '|' .. row.name .. ']]\'\'' )
	end

	if not whatUnlocksThis[1] then
		-- Not unlocked by anything.
		return ''
	end

	return '<div class="unlockedby">Unlocked by ' .. table.concat( whatUnlocksThis, ', ' ) .. '.</div>'
end

return p
