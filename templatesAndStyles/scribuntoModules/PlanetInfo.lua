local p = {}
local cargo = mw.ext.cargo

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
	local fields = 'name,minTier,maxTier,minGravity,maxGravity,minDayLight,maxDayLight,id'
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
	local fields = 'layer,primaryRegion,secondaryRegions,dungeons'
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
	local fields = 'oceanLiquid,caveLiquid,biome,name=biomeName,weatherPools,statusEffects,region.id=id'
	local queryOpt = {
		where = 'region.id IN (' .. table.concat( quotedRegionNames, ',' ) .. ')',
		join = 'biome.id=region.biome',
		limit = 5000
	}

	return cargo.query( tables, fields, queryOpt ) or {}
end

-- Format the gravity number: add green color if less than 80, red if 100 or more.
-- (here 80 is the most comfortable gravity - the gravity of starting Garden planet)
-- @param {integer} gravity
-- @param {string}
local function addColorToGravity( gravity )
	local color
	if gravity < 80 then
		color = 'green'
	elseif gravity >= 100 then
		color = '#bb0000'
	end

	if color then
		gravity = '<span style="color:' .. color .. '">' .. gravity .. '</span>'
	end

	return gravity
end

-- Based on information about planetary region, return wikitext that describes this region.
-- @param {table} metadata One of the elements of array that was returned by queryRegions().
-- @return {string}
local function describeRegion( info )
	if not info then
		-- TODO: handle this elsewhere.
		return '<div style="display: inline-block; margin: 5px;"><span class="error">Unknown region</span></div>'
	end

	local ret = '<b>[[' .. info.biomeName .. ']]</b>'
	if info.oceanLiquid ~= '' then
		-- TODO: add links to liquids (and possibly icons).
		ret = ret .. '\n* Ocean liquid: ' .. string.gsub( info.caveLiquid, ',', ', ' )
	end
	if info.caveLiquid ~= '' then
		-- TODO: add links to liquids (and possibly icons).
		ret = ret .. '\n* Cave liquid: ' .. string.gsub( info.caveLiquid, ',', ', ' )
	end

	-- TODO: don't show status effects for non-primary biomes.
	-- (because status effects from subbiomes are not applied)
	if info.statusEffects ~= '' then
		ret = ret .. '\n* Status effects: ' .. string.gsub( info.statusEffects, ',', ', ' )
	end

	-- TODO: this likely doesn't need to be show in the region (there should be "possible weathers" below instead),
	-- and we should show the contents of weather pool (not just its name).
	if info.weatherPools ~= '' then
		ret = ret .. '\n* Weather pools: ' .. string.gsub( info.weatherPools, ',', ', ' )
	end

	ret = ret .. '\n* biomeId=' .. info.biome .. ', regionId=' .. info.id
	ret = ret .. '\n'

	return '<div class="regioninfo" style="border: 1px solid #333; padding: 5px 0 2px 5px; margin: 5px; display: inline-block; width: 350px; min-height: 100px;">' .. ret .. '</div>'
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

	-- Planets don't have enough information to need a full infobox.
	-- (most of the specifics are in biome pages, not in planet pages)
	ret = ret .. '<h2>Details</h2>\n'
	ret = ret .. '* <b>Name</b>: ' .. row.name .. '\n'
	if row.minGravity ~= '' then
		ret = ret .. '* <b>Gravity</b>: ' .. addColorToGravity( tonumber( row.minGravity ) )
		if row.minGravity ~= row.maxGravity then
			ret = ret .. ' - ' .. addColorToGravity( tonumber( row.maxGravity ) )
		end
		ret = ret .. '\n'
	end

	if row.minDayLight ~= '' then
		ret = ret .. '* <b>Light level (day)</b>: ' .. row.minDayLight
		if row.minDayLight ~= row.maxDayLight then
			ret = ret .. ' - ' .. row.maxDayLight
		end
		ret = ret .. '\n'
	end

	-- Find all layers
	ret = ret .. '<h3>Layers</h3>'

	local mentionedRegions = {} -- { "regionName1": true, ... }
	local layerNameToInfo = {} -- { "surface: { ... }, "subsurface": { ... }, ... }
	for _, layerInfo in ipairs( queryAllLayers( planetType ) ) do
		if layerInfo.primaryRegion == '' then
			layerInfo.primaryRegion = {}
		else
			layerInfo.primaryRegion = mw.text.split( layerInfo.primaryRegion, ',' )
		end

		if layerInfo.secondaryRegions == '' then
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

	local uniqueRegionNames = {} -- { "regionName1", "regionName2", ... }
	for regionName in pairs( mentionedRegions ) do
		table.insert( uniqueRegionNames, regionName );
	end

	local regionNameToInfo = {} -- { "tidewaterfloor": { ... }, ... }
	for _, regionInfo in ipairs( queryRegions( uniqueRegionNames ) ) do
		regionNameToInfo[regionInfo.id] = regionInfo
	end

	ret = ret .. '\n{| class="wikitable"\n! Layer !! Primary region !! Secondary regions !! Dungeons'
	for _, layerName in ipairs( OrderOfShownLayers ) do
		local layerInfo = layerNameToInfo[layerName]

		ret = ret .. '\n|-\n! ' .. mw.getContentLanguage():ucfirst( layerName )
		if not layerInfo then
			-- Fallback for worlds that lack some layers.
			ret  = ret .. '\n| colspan="3" style="text-align: center; font-style: italic;background-color: #eee;" | Nothing in this layer'
		else
			ret = ret .. '\n| style="vertical-align: top;" | '
			for _, regionName in ipairs( layerInfo.primaryRegion ) do
				ret = ret .. describeRegion( regionNameToInfo[regionName] )
			end

			ret = ret .. '\n| style="vertical-align: top;" | '
			for _, regionName in ipairs( layerInfo.secondaryRegions ) do
				ret = ret .. describeRegion( regionNameToInfo[regionName] )
			end

			ret = ret .. '\n| style="vertical-align: top;" | ' .. string.gsub( layerInfo.dungeons, ',', ', ' )
		end
	end
	ret = ret .. '\n|}\n'

	return ret
end

return p
