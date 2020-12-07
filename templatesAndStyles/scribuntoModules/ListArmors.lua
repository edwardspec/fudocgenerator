local p = {}
local cargo = mw.ext.cargo

-- Print the list of all armor sets in the game. (based on [[Special:CargoTables/item]])
-- Usage: {{#invoke: ListArmors|ListAllSets}}
function p.ListAllSets()
	-- Perform a SQL query to the Cargo database.
	local tables = 'armorset'
	local fields = 'tier,rarity,headPage,chestPage,legsPage,damage,protection,energy,health,setBonus,price'
	local queryOpt = {
		limit = 5000,
		orderBy = 'tier DESC,price DESC'
	}
	local rows = cargo.query( tables, fields, queryOpt ) or {}

	-- Show a table of all sets.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! Tier !! Rarity !! Head !! Chest !! Legs !! Power multiplier !! Protection !! Max energy !! Max health !! Set bonus !! Total price\n'

	for _, row in ipairs( rows ) do
		ret = ret .. '|-\n|' .. row.tier .. '||' .. row.rarity ..
			'||' .. ( row.headPage ~= '' and '[[' .. row.headPage .. ']]' or '' )  ..
			'||' .. ( row.chestPage ~= '' and '[[' .. row.chestPage .. ']]' or '' ) ..
			'||' .. ( row.legsPage ~= '' and '[[' .. row.legsPage .. ']]' or '' ) ..
			'||' .. row.damage .. '%' ..
			'||' .. row.protection ..
			'||' .. row.energy ..
			'||' .. row.health ..
			'||' .. row.setBonus ..
			'\n|' .. row.price .. '\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p
