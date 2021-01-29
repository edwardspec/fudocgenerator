local p = {}
local cargo = mw.ext.cargo

-- Print "on what planets can we find this biome" information.
-- Usage: {{#invoke: BiomeInfo|OnWhatPlanets|sulphuric}}
-- First parameter: biome ID, e.g. "supermatterzone".
function p.OnWhatPlanets( frame )
	local args = frame.args
	if not args[1] then
		args = frame:getParent().args
	end

	local biomeCode = args[1]
	if not biomeCode then
		return ''
	end

	-- Keep a prioritized list of what planets have this biome:
	-- 1) for planets where this is primary biome: { "sulphuric" = "primary" }.
	-- 2) for planets where this is one subbiome of many: { "sulphuric" = 7 },
	-- where 7 is the number of competing subbiomes on this planet in the same layers as biome we need.
	local possiblePlanets = {}

	local tables = 'layer,region'
	local fields
	local queryOpt = {
		join = 'layer.primaryRegion HOLDS region.id',
		where = 'region.biome="' .. biomeCode .. '"'
	}

	-- First find the planets where this is a primary biome.
	fields = 'planet'
	queryOpt.join = 'layer.primaryRegion HOLDS region.id'
	for _, row in ipairs( cargo.query( tables, fields, queryOpt ) or {} ) do
		possiblePlanets[row.planet] = 'primary'
	end

	-- Find the planets where this is a secondary biome.
	fields = 'planet,secondaryRegions__full=competitors'
	queryOpt.join = 'layer.secondaryRegions HOLDS region.id'

	for _, row in ipairs( cargo.query( tables, fields, queryOpt ) or {} ) do
		local competitors = mw.text.split( row.competitors, ',' )
		possiblePlanets[row.planet] = #competitors
	end

	-- Remove an empty row that Cargo queries with HOLDS might create when they find nothing.
	possiblePlanets[''] = nil

	-- Query the "planet" table for human-readable names of these planets.
	local planetTypeToName = {} -- { planetCode: planetName, ... }
	local planetTypes = {} -- { planetCode1, planetCode2, ... }
	local quotedPlanetTypes = {}
	for planetCode in pairs(possiblePlanets) do
		table.insert( planetTypes, planetCode )
		table.insert( quotedPlanetTypes, '"' .. planetCode .. '"' )
	end

	if #planetTypes == 0 then
		-- Not found anywhere.
		return ''
	end

	queryOpt = { where = 'id IN (' .. table.concat( quotedPlanetTypes, ',' ) .. ')' }
	for _, row in ipairs( cargo.query( 'planet', 'id,name', queryOpt ) or {} ) do
		planetTypeToName[row.id] = row.name
	end

	-- Sort the planetTypes array by priority: planets where this is a primary biome go first,
	-- then planets where this is a subbiome, sorted by number of competing subbiomes.
	table.sort( planetTypes, function ( a, b )
		local aIsPrimary = ( possiblePlanets[a] == 'primary' )
		local bIsPrimary = ( possiblePlanets[b] == 'primary' )

		if aIsPrimary and not bIsPrimary then return true end
		if bIsPrimary and not aIsPrimary then return false end
		if aIsPrimary and bIsPrimary then return a < b end

		return possiblePlanets[a] < possiblePlanets[b]
	end )

	-- Show the human-readable list of correctly sorted biomes.
	local links = {}
	for _, planetCode in ipairs( planetTypes ) do
		local isPrimary = ( possiblePlanets[planetCode] == 'primary' )
		local link = '[[' .. planetTypeToName[planetCode] .. ']]'

		if isPrimary then
			table.insert( links, "'''" .. link .. "''' (primary biome)" )
		else
			table.insert( links, link );
		end
	end

	return table.concat( links, ', ' )
end

return p
