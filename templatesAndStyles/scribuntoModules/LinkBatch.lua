-- This module is for making human-readable wiki links to Items, Monsters, etc. by their IDs.
-- It's meant to be used by other modules.
--
-- It retrieves names of those Items, etc. via 1 SQL query, which is good for performance/limits,
-- assuming you call addItem(), etc. on every item code for which you plan to call getItemLink().
-- If you only need 1 link per page, then it's ok to not call addItem().
--
-- Note: we assume that Cargo table of Items, etc. contains fields "id", "name" and "wikiPage".

local p = {}
local cargo = mw.ext.cargo

-- Name of uploaded image, depending on ID of Item, Monster, etc.
-- Used by getLink() if the icon was requested.
local iconFilenameFormat = {
	item = 'Item_icon_%s.png',
	statuseffect = 'Status_icon_%s.png'
}

local hasWikiPageField = {
	item = true
}

local hasHasIconField = {
	statuseffect = true
}

-- Status of all Items, etc. that were added via add(). See add() for its format.
local linkCache = {}

-- @param {string} cargoTable
-- @return {table[]}
local function getOrMakeGroup( cargoTable )
	if not linkCache[cargoTable] then
		linkCache[cargoTable] = {}
	end
	return linkCache[cargoTable]
end

-- Remember the intention to call getLink() in some object in the future.
-- Calling add() in advance will allow us to greatly reduce the number of SQL queries.
-- @param {string} cargoTable
-- @param {string} id
local function add( cargoTable, id )
	local group = getOrMakeGroup( cargoTable )
	group[id] = { loaded = false };
end

-- Load page names for all entities that were previously passed to add().
local function lazyLoadGroup( cargoTable )
	local group = getOrMakeGroup( cargoTable )
	local quotedIds = {}
	for id, linkData in pairs( group ) do
		if not linkData.loaded then
			-- This link is not prepared yet. Include it into the next SQL query.
			-- Note: Cargo does its own sanitizing, so it's ok to just surround "id" in quotes.
			table.insert( quotedIds, '"' .. id .. '"' )
		end
	end

	if #quotedIds == 0 then
		-- All links are already known.
		return
	end

	local fields = 'id,name'
	if hasWikiPageField[cargoTable] then
		fields = fields .. ',wikiPage'
	end

	if hasHasIconField[cargoTable] then
		fields = fields .. ',hasIcon'
	end

	if cargoTable == 'statuseffect' then
		fields = fields .. ',resistWith'
	end

	local rows = cargo.query( cargoTable, fields, {
		where = 'id IN (' .. table.concat( quotedIds, ',' ) .. ')'
	} ) or {}

	for _, row in ipairs( rows ) do
		local linkData = group[row.id]

		linkData.displayName = row.name
		linkData.wikiPage = row.wikiPage or row.name
		linkData.hasIcon = row.hasIcon == 'true'
		linkData.loaded = true

		if row.resistWith and row.resistWith ~= '' then
			linkData.resistWith = row.resistWith
		end
	end

	-- Double-check that all entities were loaded.
	for _, linkData in pairs( group ) do
		if not linkData.loaded then
			-- Still not loaded (for example, an ID of nonexistent item).
			linkData.notFound = true
			linkData.loaded = true
		end
	end
end

-- @param {string} get
-- @param {table} renderOptions
-- @return {string}
--
--  Default options: { icon = false, text = true, hideParentheses = true, iconWidth = "16px", nolink = false, allowUnknown = false }
local function getLink( cargoTable, id, renderOptions )
	local renderOptions = renderOptions or {}
	local group = getOrMakeGroup( cargoTable )
	local linkData = group[id]

	if not linkData then
		-- Caller didn't run add() on this entity before calling getLink()!
		add( cargoTable, id )
		linkData = group[id]
	end

	if not linkData.loaded then
		lazyLoadGroup( cargoTable )
	end

	if linkData.notFound then
		-- Unknown item, etc.
		if not renderOptions.allowUnknown then
			return '<span class="error">Unknown ' .. cargoTable .. ': <code>' .. id .. '</code></span>'
		end

		-- Fallback
		linkData = { displayName = id, wikiPage = id }
	end

	local filename = string.format( iconFilenameFormat[cargoTable], id )
	if renderOptions.icon == 'ifExists' then
		-- "Include icon only if it exists" mode
		if hasHasIconField[cargoTable] then
			renderOptions.icon = linkData.hasIcon
		else
			renderOptions.icon = mw.title.new( filename, 6 ).fileExists
		end
	end

	-- Make a wikitext link.
	local ret = ''
	if renderOptions.icon then
		ret = ret .. '[[File:' .. filename .. '|alt=' .. linkData.wikiPage ..
			'|' .. ( renderOptions.iconWidth or '16px' ) .. '|link='

		if not renderOptions.nolink then
			ret = ret .. linkData.wikiPage
		end

		ret = ret .. ']] '
	end

	if renderOptions.text ~= false then
		if renderOptions.nolink then
			-- Text only.
			ret = ret .. linkData.displayName
		else
			ret = ret .. '[[' .. linkData.wikiPage
			if renderOptions.hideParentheses ~= false and linkData.wikiPage ~= linkData.displayName then
				-- Normally we make links like [[Something (decorative)|Something]], hiding "(decorative)" part,
				-- but this can be disabled via { hideParentheses = false }
				ret = ret .. '|' .. linkData.displayName
			end
			ret = ret .. ']]'
		end

		if linkData.resistWith then
			ret = ret .. ' <i>(immune at: ' .. linkData.resistWith .. ')</i>'
		end
	end

	return ret
end

-- @param {string} itemCode
function p.AddItem( itemCode )
	add( 'item', itemCode )
end

-- @param {string} effectCode
function p.AddEffect( effectCode )
	add( 'statuseffect', effectCode )
end

-- @param {string} itemCode
-- @param {table} renderOptions
function p.GetItemLink( itemCode, renderOptions )
	return getLink( 'item', itemCode, renderOptions )
end

-- @param {string} effectCode
-- @param {table} renderOptions
function p.GetEffectLink( effectCode, renderOptions )
	return getLink( 'statuseffect', effectCode, renderOptions )
end

return p
