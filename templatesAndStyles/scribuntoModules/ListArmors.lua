local p = {}
local cargo = mw.ext.cargo

local armorSlots = {
	headarmour = "head",
	headwear = "head",
	chestarmour = "chest",
	chestwear = "chest",
	legarmour = "legs",
	legwear = "legs"
}

-- Print the list of all armor sets in the game. (based on [[Special:CargoTables/item]])
-- Usage: {{#invoke: ListArmors|ListAllSets}}
function p.ListAllSets( frame )
	-- Perform a SQL query to the Cargo database.
	local tables = 'item,item_metadata=A'
	local fields = 'item.id=id,name,description,category,tier,rarity,price,wikiPage,A.value=protection'
	local queryOpt = {
		-- TODO: this is minimal testing query, should also add headwear,chestwear,legswear later.
		where = 'category IN ("headarmour","chestarmour","legarmour") AND A.prop="protection"',
		join = 'A.id=item.id',
		limit = 5000,
		orderBy = 'name'
	}
	local rows = cargo.query( tables, fields, queryOpt )
	if not rows then
		-- Nothing found.
		return ''
	end

	local sets = {}
	for _, row in ipairs( rows ) do
		local setId = row.id:gsub( 'head', '' ):gsub( 'chest', '' ):gsub( 'legs', '' ):gsub( 'pants', '' )
		local set = sets[setId]
		if not set then
			-- Discovered a new set.
			set = {}

			set.tier = row.tier
			set.rarity = row.rarity
			set.bonus = row.description:gsub( '^.*Set Bonuses:', '' )
			set.powerMultiplier = 0
			set.protection = 0
			set.maxEnergy = 0
			set.maxHealth = 0
			set.price = 0
		end

		-- Add this item to the set.
		set[armorSlots[row.category]] = row

		set.powerMultiplier = set.powerMultiplier + ( row.powerMultiplier or 0 )
		set.protection = set.protection + ( row.protection or 0 )
		set.maxEnergy = set.maxEnergy + ( row.maxEnergy or 0 )
		set.maxHealth = set.maxHealth + ( row.maxHealth or 0 )
		set.price = set.price + ( row.price or 0 )

		sets[setId] = set
	end

	-- Show a table of all sets.
	local ret = '{| class="wikitable sortable"\n' ..
		'|-\n! Tier !! Rarity !! Head !! Chest !! Legs !! Power multiplier !! Protection !! Max energy !! Max health !! Set bonus !! Total price\n'

	for _, set in pairs( sets ) do
		ret = ret .. '|-\n|' .. set.tier .. '||' .. set.rarity ..
			'||' .. ( set.head and ( '[[' .. set.head.wikiPage .. ']]' ) or '-' ) ..
			'||' .. ( set.chest and ( '[[' .. set.chest.wikiPage .. ']]' ) or '-' ) ..
			'||' .. ( set.legs and ( '[[' .. set.legs.wikiPage .. ']]' ) or '-' ) ..
			'||' .. set.powerMultiplier ..
			'||' .. set.protection ..
			'||' .. set.maxEnergy ..
			'||' .. set.maxHealth ..
			'||' .. set.bonus ..
			'\n|' .. set.price .. '\n'
	end

	ret = ret .. '\n|}'
	return ret
end

return p
