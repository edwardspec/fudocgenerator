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
	local fields = 'oceanLiquid,caveLiquid,biome,name,weatherPools,statusEffects'
	local queryOpt = {
		where = 'id IN (' .. table.concat( quotedRegionNames, ',' ) .. ')',
		join_on = 'biome.id=region.biome'
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

	local layerNameToInfo = {}
	for _, layerInfo in ipairs( queryAllLayers( planetType ) ) do
		layerNameToInfo[layerInfo.layer] = layerInfo
	end

	ret = ret .. '\n{| class="wikitable"\n! Layer !! Primary region !! Secondary regions !! Dungeons'
	for _, layerName in ipairs( OrderOfShownLayers ) do
		local layerInfo = layerNameToInfo[layerName]

		ret = ret .. '\n|-\n! ' .. mw.getContentLanguage():ucfirst( layerName )
		if not layerInfo then
			-- Fallback for worlds that lack some layers.
			ret  = ret .. '\n| colspan="3" style="text-align: center; font-style: italic;background-color: #eee;" | Nothing in this layer'
		else
			ret = ret .. '\n| ' .. string.gsub( layerInfo.primaryRegion, ',', ', ' ) ..
				'\n| ' .. string.gsub( layerInfo.secondaryRegions, ',', ', ' ) ..
				'\n| ' .. string.gsub( layerInfo.dungeons, ',', ', ' )
		end
	end
	ret = ret .. '\n|}\n'

	return ret
end

return p
