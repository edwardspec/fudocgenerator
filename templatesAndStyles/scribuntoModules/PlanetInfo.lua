local p = {}
local cargo = mw.ext.cargo
local LinkBatch = require( 'Module:LinkBatch' )

-- Layers will be shown in this order.
-- For example, Surface layer is the most important and must be shown first,
-- while the Atmosphere layer is the same for almost all planets, and is therefore of least interest.
local OrderOfShownLayers = {
	'surface',
	'subsurface',
	'underground1',
	'underground2',
	'underground3',
	'core',
	'atmosphere',
	'space'
}

-- Perform a SQL query to "planet" table in the Cargo database (see Special:CargoTables/planet).
-- @param {string} planetType
-- @return {table} Database row.
local function queryPlanet( planetType )
	local tables = 'planet'
	local fields = 'name,stars,minTier,maxTier,minGravity,maxGravity,minDayLight,maxDayLight,id'
	local queryOpt = {
		where = 'id="' .. planetType .. '"',
		limit = 1
	}
	return ( cargo.query( tables, fields, queryOpt ) or {} )[1]
end

-- Perform a SQL query to "layer" table in the Cargo database (see Special:CargoTables/layer)
-- to find ALL layers of some planet type.
-- @param {string} planetType
-- @return {table} Array of database rows (all layers).
local function queryAllLayers( planetType )
	local tables = 'layer'
	local fields = 'layer,primaryRegion,secondaryRegions,dungeonNames=dungeons'
	local queryOpt = {
		where = 'planet="' .. planetType .. '"'
	}
	return cargo.query( tables, fields, queryOpt ) or {}
end

-- Perform a SQL query to "region" table in the Cargo database (see Special:CargoTables/region)
-- to find multiple regions (and their accompanying biome names) in one query.
-- @param {string[]} arrayOfRegionNames
-- @return {table} Array of database rows (all layers).
local function queryRegions( arrayOfRegionNames )
	-- Wrap all region names in quotes.
	-- These are not user-supplied (they come from Cargo database and are known to be valid), so this is enough.
	local quotedRegionNames = {}
	for idx, regionName in ipairs( arrayOfRegionNames ) do
		quotedRegionNames[idx] = '"' .. regionName .. '"'
	end

	local tables = 'region,biome'
	local fields = 'oceanLiquid,caveLiquid,biome,wikiPage=biomePage,weatherPools,statusEffects,region.id=id'
	local queryOpt = {
		where = 'region.id IN (' .. table.concat( quotedRegionNames, ',' ) .. ')',
		join = 'biome.id=region.biome',
		limit = 5000
	}

	return cargo.query( tables, fields, queryOpt ) or {}
end

-- Table populated by batchLoadTheseRegions() and used in describeRegion().
-- { "tidewaterfloor": { ... }, ... }
local regionNameToInfo = {}

-- Populate the table "regionNameToInfo" (which is later used in describeRegion) in 1 SQL query.
-- @param {table} regionsToLoad Format: { "regionName1": true, "regionName2": true, ... }
local function batchLoadTheseRegions( regionsToLoad )
	local uniqueRegionNames = {} -- { "regionName1", "regionName2", ... }
	for regionName in pairs( regionsToLoad ) do
		table.insert( uniqueRegionNames, regionName );
	end

	for _, info in ipairs( queryRegions( uniqueRegionNames ) ) do
		if info.oceanLiquid then
			info.oceanLiquidItems = mw.text.split( info.oceanLiquid, ',' )

			-- Remember the mentioned liquids, they will be used in batchLoadTheseItemLinks().
			for _, liquid in ipairs( info.oceanLiquidItems ) do
				LinkBatch.AddItem( liquid )
			end
		end

		if info.caveLiquid then
			info.caveLiquidItems = mw.text.split( info.caveLiquid, ',' )

			for _, liquid in ipairs( info.caveLiquidItems ) do
				LinkBatch.AddItem( liquid )
			end
		end

		regionNameToInfo[info.id] = info
	end
end

-- Given the array of item codes, return wikitext that shows their links and/or icons.
-- @param {string} E.g. { "ff_mercury", "liquidoil" }
-- @return {string}
local function showItemList( itemCodes )
	local ret = ''
	for _, itemCode in ipairs( itemCodes ) do
		ret = ret .. LinkBatch.GetItemLink( itemCode, {
			icon = true,
			text = false,
			hideParentheses = false
		} ) .. ' '
	end
	return ret
end

-- Based on information about planetary region, return wikitext that describes this region.
-- @param {string} Name of region. This must have been passed to batchLoadTheseRegions() earlier.
-- @param {string} isPrimarySurface True if we we need to show weather and status effects.
-- @return {string}
local function describeRegion( regionName, isPrimarySurface )
	local info = regionNameToInfo[regionName]
	if not info then
		return '<div style="display: inline-block; margin: 5px;"><span class="error">Unknown region: <code>' ..
			regionName .. '</code></span></div>'
	end

	-- Note: if biome is called "Something (variant)", but the official biomeName is "Something",
	-- then we don't hide "(variant) from readers (so we don't need biome.name field in this link).
	local ret = '<b>[[' .. info.biomePage .. ']]</b>'
	if info.oceanLiquidItems then
		ret = ret .. '\n* <b><big>Ocean liquid</big></b>: ' .. showItemList( info.oceanLiquidItems )
	end
	if info.caveLiquidItems then
		ret = ret .. '\n* Cave liquid: ' .. showItemList( info.caveLiquidItems )
	end

	-- Add image of every biome (if it exists), placeholder if it doesn't.
	ret = ret .. '\n<div class="placeholder-image">[[File:Biome_image_' .. info.biome .. '.jpg|250px|alt=|]]</div>\n'

	-- Strip suffix like ":2" or ":3" from pseudo-regions like "core:2" (for regions that have 2+ biomes).
	local regionCode = string.gsub( info.id, ':.+', '' )
	if regionCode == info.biome then
		ret = ret .. '\n<small>biome/region ID: ' .. info.biome .. '</small>'
	else
		ret = ret .. '\n<small>biome ID: ' .. info.biome .. '<br>' ..
			'region ID: ' .. regionCode .. '</small>'
	end

	-- Show weather and status effects, but only for primary regions of Surface layer,
	-- because status effects and weather from subbiomes are not applied.
	if isPrimarySurface then
		if info.statusEffects then
			ret = ret .. '\n<h5>Status effects</h5>'

			local effects = mw.text.split( info.statusEffects, ',' )
			for _, effectCode in ipairs( effects ) do
				LinkBatch.AddEffect( effectCode )
			end

			for _, effectCode in ipairs( effects ) do
				ret = ret .. '\n* ' .. LinkBatch.GetEffectLink( effectCode, {
					nolink = true,
					icon = 'ifExists',
					allowUnknown = true
				} )
			end
		end

		if info.weatherPools then
			ret = ret .. '\n<h5>Weather pools</h5>'

			-- Because our Cargo database doesn't have planets like Unknown or Superdense (would be useless),
			-- most planets won't have more than 1-2 primary biomes, so we can do 1 SQL query per each,
			-- and batch-loading the weatherpools from different "primary surface" regions is unnecessary.
			local quotedPoolIds = {}
			for _, poolName in ipairs( mw.text.split( info.weatherPools, ',' ) ) do
				table.insert( quotedPoolIds, '"' .. poolName .. '"' )
			end

			local rows = cargo.query( 'weatherpool', 'wikitext', {
				where = 'id IN (' .. table.concat( quotedPoolIds, ',' ) .. ')',
				orderBy = 'id'
			}) or {}
			for index, row in ipairs( rows ) do
				ret = ret .. "\n'''Type " .. index .. "'''\n" .. row.wikitext .. '\n'
			end
		end
	end

	ret = ret .. '\n'
	return '<div class="regioninfo">' .. ret .. '</div>'
end

-- Print information about planet and list all possible regions in all its layers.
-- (based on Cargo tables "planet", "layer", "region" and "biome)
-- Usage: {{#invoke: PlanetInfo|Main|sulphuric}}
-- First parameter: planet type ID, e.g. "desert".
-- Optional parameter: nocat=1 - if present, this template won't add any categories to the current article. (can used in examples, help pages, etc.)
function p.Main( frame )
	local args = frame.args
	if not args[1] then
		args = frame:getParent().args
	end

	local planetType = args[1] or 'nosuchplanet'
	local nocat = args['nocat'] or false

	-- Perform a SQL query to the Cargo database (see Special:CargoTables/planet).
	local row = queryPlanet( planetType )
	if not row then
		-- Planet not found in the database.
		if nocat then
			return ''
		end
		return '[[Category:Planet pages with broken PlanetInfo template]]'
	end

	local ret = ''
	if not nocat then
		ret = ret .. '[[Category:Planets]]\n'
	end

	-- Add styles
	ret = ret .. frame:extensionTag { name = 'templatestyles', args = { src = 'PlanetInfo.css' } }

	-- Planets don't have enough information to need a full infobox.
	-- (most of the specifics are in biome pages, not in planet pages)
	ret = ret .. '<h2>Details</h2>\n'
	ret = ret .. '\n* <b>Name</b>: ' .. row.name
	ret = ret .. '\n* <b>Tier</b>: ' .. row.minTier
	if row.minTier ~= row.maxTier then
		ret = ret .. ' - ' .. row.maxTier
	end

	if row.minGravity then
		ret = ret .. '\n* <b>Gravity</b>: ' .. row.minGravity
		if row.minGravity ~= row.maxGravity then
			ret = ret .. ' - ' .. row.maxGravity
		end
	end

	if row.minDayLight then
		ret = ret .. '\n* <b>Light level (day)</b>: ' .. row.minDayLight
		if row.minDayLight ~= row.maxDayLight then
			ret = ret .. ' - ' .. row.maxDayLight
		end
	end

	ret = ret .. '\n* <b>Found around stars</b>: ' .. string.gsub( row.stars, ',', ', ' )

	-- Find all layers
	ret = ret .. '\n<h3>Layers</h3>'

	local mentionedRegions = {} -- { "regionName1": true, ... }
	local layerNameToInfo = {} -- { "surface: { ... }, "subsurface": { ... }, ... }
	for _, layerInfo in ipairs( queryAllLayers( planetType ) ) do
		if not layerInfo.primaryRegion then
			layerInfo.primaryRegion = {}
		else
			layerInfo.primaryRegion = mw.text.split( layerInfo.primaryRegion, ',' )
		end

		if not layerInfo.secondaryRegions then
			layerInfo.secondaryRegions = {}
		else
			layerInfo.secondaryRegions = mw.text.split( layerInfo.secondaryRegions, ',' )
		end

		layerNameToInfo[layerInfo.layer] = layerInfo

		-- Remember the list of regions,
		-- so that we can obtain the information about all of them in 1 SQL query.
		for _, regionName in ipairs( layerInfo.primaryRegion ) do
			mentionedRegions[regionName] = true
		end

		for _, regionName in ipairs( layerInfo.secondaryRegions ) do
			mentionedRegions[regionName] = true
		end
	end

	batchLoadTheseRegions( mentionedRegions )

	ret = ret .. '\n{| class="wikitable planetlayers"\n! Layer\n! style="width:250px;" | Primary region\n! Secondary regions !! Dungeons'
	for _, layerName in ipairs( OrderOfShownLayers ) do
		local layerInfo = layerNameToInfo[layerName]

		ret = ret .. '\n|-\n! class="layername" | <h4>' .. mw.getContentLanguage():ucfirst( layerName ) .. '</h4>'
		if not layerInfo then
			-- Fallback for worlds that lack some layers.
			ret  = ret .. '\n| colspan="3" class="emptylayer" | Nothing in this layer'
		else
			ret = ret .. '\n| style="vertical-align: top;" | '
			for _, regionName in ipairs( layerInfo.primaryRegion ) do
				ret = ret .. describeRegion( regionName, layerName == 'surface' )
			end

			ret = ret .. '\n| style="vertical-align: top;" | '
			for _, regionName in ipairs( layerInfo.secondaryRegions ) do
				ret = ret .. describeRegion( regionName, false )
			end

			ret = ret .. '\n| style="vertical-align: top;" | '
			for _, dungeonName in ipairs( mw.text.split( layerInfo.dungeons or '', ',' ) ) do
				ret = ret .. '\n* ' .. dungeonName
			end
		end
	end
	ret = ret .. '\n|}\n'

	return ret
end

return p
