local p = {}
local cargo = mw.ext.cargo

-- Stations will be in this order and these subsections in the results of RecipesWhereItemIs().
local OrderOfCraftingStations = {
	{ nil, {
		'Growing Tray',
		'Incubator',
		'Upgrade crafting station'
	} },
	{ 'Reactor fuel', {
		'Alternator Generator',
		'Combustion Generator',
		'Hydraulic Dynamo',
		'Fission Reactor',
		'Small Fusion Reactor',
		'Large Fusion Reactor',
		'Quantum Reactor',
		'Precursor Reactor'
	} },
	{ 'Extractions', {
		'Honey Extractor',
		'Extraction Lab',
		'Extraction Lab MKII',
		'Quantum Extractor',
		'Any Centrifuge',
		'Gas Centrifuge',
		'Sifter',
		'Rock Crusher',
		'Electric Furnace',
		'Blast Furnace',
		'Arc Smelter',
		'Liquid Mixer',
		'Xeno Research Lab',
		'Erchius Converter',
		'Autopsy Table',
		'Psionic Amplifier'
	} },
	{ 'Exploration', {
		'Biome blocks',
		'Biome chests',
		'Biome monsters',
		'Biome objects',
		'Drops from breakable objects',
		'Biome trees',
		'Drops from trees',
		'Treasure pool'
	} },
	{ 'Environment', {
		'Liquid Collector',
		'Atmospheric Condenser',
		'Well',
		'Wooden Water Tower',
		'Water Generator',
		'Xian Well'
	} },
	{ 'Animals', {
		'Apiary',
		'Bee Refuge',
		'Bug House',
		'Farm Beasts',
		'Monster drops',
		'Monster drops (hunting)',
		'Moth Trap',
		'Moth Trap II',
		'Lobster Trap',
		'Pest Trap'
	} }
}

-- Print the "Items crafted here" section for a crafting station. (based on [[Special:CargoTables/recipe]])
-- Usage: {{#invoke: ListRecipes|RecipesCraftedAt|Human-readable name of crafting station}}
-- Optional parameters:
-- @param {string} header Text of the header that will be prepended to results (default: "Items crafted here").
function p.RecipesCraftedAt( frame )
	local args = frame.args
	if not args[1] then
		args = frame:getParent().args
	end

	local stationName = args[1]
	if not stationName then
		return ''
	end

	-- Perform a SQL query to the Cargo database.
	local rows = cargo.query( 'recipe', 'wikitext', {
		where = 'station="' .. stationName .. '"',
		limit = 5000
	} ) or {}
	if not rows[1] then
		-- No recipes found.
		return ''
	end

	local ret = '<h2>' .. ( args['header'] or 'Items crafted here' ) .. '</h2>'
	for _, row in ipairs( rows ) do
		ret = ret .. row.wikitext
	end
	return ret
end

-- Print "Used for" or "How to obtain" section for an item. (based on [[Special:CargoTables/recipe]])
-- This will show ALL recipes where item A can be either created (role=outputs) or spent (role=inputs),
-- Usage:
-- {{#invoke: ListRecipes|RecipesWhereItemIs|item=cookedfish|role=outputs|header=How to obtain}}
-- {{#invoke: ListRecipes|RecipesWhereItemIs|item=cookedfish|role=inputs|header=Used for}}
function p.RecipesWhereItemIs( frame )
	local args = frame.args
	if not args.item then
		args = frame:getParent().args
	end

	local itemId = args.item
	local role = args.role
	local header = args.header
	local noGroupHeaders = args.noGroupHeaders

	if not itemId then
		return '<span class="error">RecipesWhereItemIs: item= parameter is mandatory.</span>'
	end

	if not header then
		return '<span class="error">RecipesWhereItemIs: header= parameter is mandatory.</span>'
	end

	if role ~= 'inputs' and role ~= 'outputs' then
		return '<span class="error">RecipesWhereItemIs: role= parameter must be "inputs" or "outputs".</span>'
	end

	-- Perform a SQL query to the Cargo database.
	local where = role .. ' HOLDS ' .. ' "' .. itemId .. '"'
	local rows = cargo.query( 'recipe', 'station,wikitext', {
		where = where,
		limit = 5000
	} ) or {}
	if not rows[1] then
		-- No recipes found.
		return ''
	end

	-- First of all, let's group the recipes by crafting stations.
	local stationNameToRecipes = {}
	for _, row in ipairs( rows ) do
		if not stationNameToRecipes[row.station] then
			stationNameToRecipes[row.station] = {}
		end

		table.insert( stationNameToRecipes[row.station], row.wikitext )
	end

	-- Print all per-station subheaders in correct order.
	local ret = ''
	for _, stationsGroup in ipairs( OrderOfCraftingStations ) do
		local sectionHeader, stationNames = unpack( stationsGroup )

		local sectionText = ''
		for _, stationName in ipairs( stationNames ) do
			local recipes = stationNameToRecipes[stationName]

			if recipes then
				sectionText = sectionText .. '<h4>[[' .. stationName .. ']]</h4>' .. table.concat( recipes )

				-- Remove this station from "stationNameToRecipes" list. The only stations that will remain
				-- are those not listed in OrderOfCraftingStations (they will be handled below).
				stationNameToRecipes[stationName] = nil
			end
		end

		if sectionText ~= '' then
			if sectionHeader and not noGroupHeaders then
				ret = ret .. '<h3>' .. sectionHeader .. '</h3>'
			end

			ret = ret .. sectionText
		end
	end

	-- Additionally print recipes of all stations that weren't in "OrderOfCraftingStations" array.
	-- They are treated as "Crafting" subsection.
	-- These stations don't have a custom sorting order, so they must be sorted alphaberically.
	local craftingStations = {} -- { "name1", "name2", ... }
	for stationName in pairs( stationNameToRecipes ) do
		table.insert( craftingStations, stationName )
	end

	if #craftingStations > 0 then
		table.sort( craftingStations )

		local craftingRecipes = ''
		for _, stationName in ipairs( craftingStations ) do
			local recipes = stationNameToRecipes[stationName]
			craftingRecipes = craftingRecipes .. '<h4>[[' .. stationName .. ']]</h4>' .. table.concat( recipes )
		end

		-- "Crafting" header is only needed for items that also have extraction recipes, etc.
		-- Many items have ONLY crafting recipes, and we don't need to show this header for them.
		if ret ~= '' then
			ret = ret .. '<h3>Crafting</h3>'
		end
		ret = ret .. craftingRecipes
	end

	return '<h2>' .. header .. '</h2>' .. ret
end

return p
