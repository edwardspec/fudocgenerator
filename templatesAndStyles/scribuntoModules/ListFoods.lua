local p = {}
local cargo = mw.ext.cargo

local describeRotting = require( 'Module:AutomaticInfoboxItem' ).DescribeRotting

-- Print the list of all foods in the game. (based on [[Special:CargoTables/item]] and [[Special:CargoTables/item_metadata]])
-- Usage: {{#invoke: ListFoods|ListAllFoods}}
function p.ListAllFoods()
	-- Perform a SQL query to the Cargo database.
	local tables = 'item,recipe'
	local fields = 'wikiPage,description,category,rarity,price,stackSize,id,wikitext'
	local queryOpt = {
		join = 'recipe.outputs__full=item.id',
		where = 'category IN ("food", "preparedFood", "drink", "medicine")',
		limit = 5000,
		orderBy = 'name'
	}
	local rows = cargo.query( tables, fields, queryOpt ) or {}

	-- Get relevant metadata for all found foods.
	local foundIds = {} -- { id1, id2, ... }
	for _, row in ipairs( rows ) do
		table.insert( foundIds, '"' .. row.id .. '"' );
	end

	local metadataRows = cargo.query( 'item_metadata', 'id,prop,value', {
		where = 'prop IN ("foodValue", "rotMinutes", "noRotting") AND id IN (' .. table.concat( foundIds, "," ) .. ')',
		limit = 5000
	} ) or {}

	local metadata = {} -- { id1: { foodValue: 20, ... }, id2: { ... } }
	for _, row in ipairs( metadataRows ) do
		if not metadata[row.id] then
			metadata[row.id] = {}
		end

		metadata[row.id][row.prop] = row.value
	end

	-- When rotting time is not specified, the food with non-zero foodValue will rot within 200 minutes.
	local defaultRottingInfo = mw.getContentLanguage():formatDuration( 200 * 60 )
	local noRottingInfo = describeRotting( { noRotting = 1 } )

	-- Show a table of all sets.
	-- Resistances must be in the same order as displayed in-game.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! Item !! Food value !! Recipe !! Description !! Rotting !! Category !! Rarity !! Price !! Stack size\n'

	for _, row in ipairs( rows ) do
		local extraInfo = metadata[row.id] or {}

		local stackSize = row.stackSize
		if stackSize == '' then
			stackSize = '1'
		end

		local rottingInfo = noRottingInfo
		if extraInfo.foodValue then -- Food without foodValue won't rot.
			rottingInfo = describeRotting( extraInfo ) or defaultRottingInfo
		end

		ret = ret .. '|-\n' ..
			'|| [[' .. row.wikiPage .. ']]' ..
			'||' .. ( extraInfo.foodValue or '' ) ..
			'||\n' .. row.wikitext .. '\n' ..
			'||\n' .. row.description .. '\n' ..
			'||' .. rottingInfo ..
			'||' .. row.category ..
			'||' .. row.rarity ..
			'||' .. row.price ..
			'||' .. stackSize .. '\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p
