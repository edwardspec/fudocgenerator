local p = {}
local cargo = mw.ext.cargo

-- Print the list of all armor sets in the game. (based on [[Special:CargoTables/item]])
-- Usage: {{#invoke: ListArmors|ListAllSets}}
function p.ListAllSets()
	-- Perform a SQL query to the Cargo database.
	local tables = 'armorset'
	local fields = 'tier,rarity,headPage,chestPage,legsPage,damage,protection,energy,health,setBonus,price,physical,radioactive,poison,electric,fire,ice,cosmic,shadow'
	local queryOpt = {
		limit = 5000,
		orderBy = 'tier DESC,price DESC'
	}
	local rows = cargo.query( tables, fields, queryOpt ) or {}

	-- Show a table of all sets.
	-- Resistances must be in the same order as displayed in-game.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! Tier !! Rarity !! Head !! Chest !! Legs !! [[File:Damage icon.png|24px|link=|Damage|alt=Damage]]' ..
		'!! [[File:Defence icon.png|24px|link=|Protection|alt=Protection]]' ..
		'!! [[File:Energy icon.png|24px|link=|Energy|alt=Energy]]' ..
		'!! [[File:Health icon.png|24px|link=|Health|alt=Health]]' ..
		'!! [[File:Physical (Attack).png|16px|link=|Physical resistance|alt=Physical]]' ..
		'!! [[File:Frost (Attack).png|16px|link=|Ice resistance|alt=Ice]]' ..
		'!! [[File:Fire (Attack).png|16px|link=|Fire resistance|alt=Fire]]' ..
		'!! [[File:Electric (Attack).png|16px|link=|Electric resistance|alt=Electric]]' ..
		'!! [[File:Poison (Attack).png|16px|link=|Poison resistance|alt=Poison]]' ..
		'!! [[File:Radioactive (Attack).png|16px|link=|Radioactive resistance|alt=Radioactive]]' ..
		'!! [[File:Cosmic (Attack).png|16px|link=|Cosmic resistance|alt=Cosmic]]' ..
		'!! [[File:Shadow (Attack).png|16px|link=|Shadow resistance|alt=Shadow]]' ..
		'!! Set bonus !! Total price\n'

	for _, row in ipairs( rows ) do
		ret = ret .. '|-\n|' .. row.tier .. '||' .. row.rarity ..
			'||' .. ( row.headPage ~= '' and '[[' .. row.headPage .. ']]' or '' )  ..
			'||' .. ( row.chestPage ~= '' and '[[' .. row.chestPage .. ']]' or '' ) ..
			'||' .. ( row.legsPage ~= '' and '[[' .. row.legsPage .. ']]' or '' ) ..
			'||' .. row.damage .. '%' ..
			'||' .. row.protection ..
			'||' .. row.energy ..
			'||' .. row.health ..
			'||' .. row.physical ..
			'||' .. row.ice ..
			'||' .. row.fire ..
			'||' .. row.electric ..
			'||' .. row.poison ..
			'||' .. row.radioactive ..
			'||' .. row.cosmic ..
			'||' .. row.shadow ..
			'||' .. row.setBonus ..
			'\n|' .. row.price .. '\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p

