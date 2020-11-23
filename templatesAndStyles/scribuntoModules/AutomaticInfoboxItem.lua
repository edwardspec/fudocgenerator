local p = {}
local cargo = mw.ext.cargo

-- Get HTML of pretty-printed list of tags.
-- @param {string} tagsString Comma-separated tags. Example: "ranged,tool,mininggun,mininglaser".
-- @param {string} categoryPrefix String between "Category:" and ":<tag here>" in links to categories. Example: "ColonyTag".
-- @param {bool} nocat If true, categories are not added to the page.
-- @return {string}
local function tagCloud( tagsString, categoryPrefix, nocat )
	if not tagsString or tagsString == '' then
		return ''
	end

	local tagsLine = ''
	for _, tag in ipairs( mw.text.split( tagsString, ',' ) ) do
		local category = 'Category:' .. categoryPrefix .. ':' .. tag

		-- TODO: move inline CSS into TemplateStyles or something
		tagsLine = tagsLine .. ' <span class="infobox-tag" style="border: 1px solid #7f7f7f; padding: 3px; display: inline-block; margin: 2px 1px;">[[:' ..
			category .. '|' .. tag .. ']]</span>'

		if not nocat then
			tagsLine = tagsLine .. '[[' .. category .. ']]'
		end
	end

	return tagsLine
end

-- Perform a SQL query to "item" table in the Cargo database (see Special:CargoTables/item).
-- @param {string} itemId
-- @return {table} Database row.
local function queryItem( itemId )
	local tables = 'item'
	local fields = 'name,description,category,tier,rarity,price,stackSize,twoHanded,upgradeable,wikiPage,id,tags,colonyTags'
	local queryOpt = {
		where = 'id="' .. itemId .. '"',
		limit = 1
	}
	return ( cargo.query( tables, fields, queryOpt ) or {} )[1]
end

-- Perform a SQL query to "item_metadata" table in the Cargo database (see Special:CargoTables/item_metadata).
-- @param {string} itemId
-- @return {table} Array with arbitrary information: { key1 = value1, ... }, where both keys and values are strings.
local function queryItemMetadata( itemId )
	local queryOpt = {
		where = 'id="' .. itemId .. '"'
	}
	local rows = cargo.query( 'item_metadata', 'prop,value', queryOpt )
	local metadata = {}

	for _, row in ipairs( rows or {} ) do
		metadata[row.prop] = row.value
	end

	return metadata
end

-- Maps damage type (e.g. "cosmic") to the name of image in the wiki.
local damageTypeIcons = {
	physical = 'Physical (Attack).png',
	fire = 'Fire (Attack).png',
	ice = 'Frost (Attack).png',
	poison = 'Poison (Attack).png',
	electric = 'Electric (Attack).png',
	radioactive = 'Radioactive (Attack).png',
	shadow = 'Shadow (Attack).png',
	cosmic = 'Cosmic (Attack).png'
}

-- Based on item metadata, return wikitext that describes primaryAbility or altAbility of item.
-- @param {table} metadata Result of queryItemMetadata()
-- @param {bool} isPrimary True for primary ability, false for alt ability.
-- @return {table|nil} Either array of arguments to {{Infobox/field}} (if ability can be described) or nil.
local function describeAbility( metadata, isPrimary )
	local keyPrefix = 'alt.'
	if isPrimary then
		keyPrefix = ''
	end

	local damagePerHit = metadata[keyPrefix .. 'damagePerHit']
	local hitsPerSecond = metadata[keyPrefix .. 'hitsPerSecond']
	local comboSteps = metadata[keyPrefix .. 'comboSteps']
	local damageType = metadata[keyPrefix .. 'damageType']
	local abilityName = metadata[keyPrefix .. 'ability']

	local ret = ''
	if damagePerHit then
		ret = ret .. 'Damage per hit: ' .. damagePerHit .. "<br>"
	end

	if hitsPerSecond then
		ret = ret .. 'Rate of fire: ' .. hitsPerSecond .. "<br>"
	end

	if comboSteps then
		ret = ret .. comboSteps .. '-hit combo<br>'
	end

	if abilityName then
		ret = ret .. "'''Special''': " .. abilityName
	end

	if ret == '' then
		return
	end


	local fieldName = 'Alt'
	if isPrimary then
		fieldName = 'Primary'
	end

	if damageType then
		if damageTypeIcons[damageType] then
			fieldName = fieldName .. ' [[File:' .. damageTypeIcons[damageType] .. '|32px|' .. damageType .. ']]\n'
		else
			-- Unknown type, doesn't have an icon (yet?).
			ret = damageType .. "\n" .. ret
		end
	end

	return { fieldName, ret }
end

-- Print the automatic infobox of item. (based on [[Special:CargoTables/item]])
-- Usage: {{#invoke: AutomaticInfoboxItem|Main|carbonpickaxe}}
-- First parameter: item ID, e.g. "aentimber".
-- Optional parameter: nocat=1 - if present, this infobox won't add any categories to the current article. (can used in examples, help pages, etc.)
-- Optional parameter: image=Something.png - if present, will be used as infobox image (replaces the default image, which is inventory icon of the item).
-- Optional parameter: image_size=150px - if present, sets the width of image. This is only used for image from image= parameter, not for inventory icons, etc.
function p.Main( frame )
	local args = frame.args

	if not args[1] then
		-- If called from a template like {{Automatic infobox item}} without parameters, use parameters of the parent template instead.
		args = frame:getParent().args
	end

	local id = args[1] or 'fu_carbon'
	local nocat = args['nocat'] or false
	local image = args['image']

	-- Perform a SQL query to the Cargo database (see Special:CargoTables/item).
	local row = queryItem( id )
	if not row then
		-- Item not found in the database.
		if nocat then
			return ''
		end
		return '[[Category:Item pages with broken automatic infobox]]'
	end

	-- Also load item metadata (properties like "foodValue" don't have their own column,
	-- because they only make sense for a small subset of items)
	local metadata = queryItemMetadata( id )

	local ret = ''
	if not nocat then
		-- Add categories.
		ret = ret .. frame:expandTemplate{ title = 'ItemPageCategory', args = { row.category } }

		-- Sanity check: if the item got renamed in-game, then an article with old name can still have the infobox.
		-- Add such article into the tracking category:
		if row.wikiPage ~= mw.title.getCurrentTitle().text then
			ret = ret .. '[[Category:Item pages where title is different from item name in the infobox]]'
		end

		ret = ret .. '\n'
	end

	-- Format "row" (information about item: row.name, row.description, etc.) as wikitext.
	ret = ret .. '{| class="infobox"\n'
	if image then
		local imageParams = { image }
		if args['image_size'] then
			imageParams['width'] = args['image_size']
		end
		ret = ret .. frame:expandTemplate{ title = 'infobox/image', args = imageParams }
	else
		-- Check if there are images that can be added automatically.
		-- Most obtainable items have "File:Item_icon_<id>.png" (their 16x16 inventory icon).
		local iconTitle = mw.title.new( 'Item icon ' .. id .. '.png', 6 )
		if iconTitle.fileExists then
			-- Also check if we have "3x3 placed blocks" image: "Block_image_<id>.png".
			local hasBlockImage = false
			local blockImageTitle
			if row.category == "block" then
				blockImageTitle = mw.title.new( 'Block image ' .. id .. '.png', 6 )
				hasBlockImage = blockImageTitle.fileExists
			end

			if not hasBlockImage then
				-- If we don't have a block image, then inventory icon uses {{infobox/image}} (entire row of the infobox).
				ret = ret .. frame:expandTemplate{ title = 'infobox/image', args = { iconTitle.text } }
			else
				-- If we have a block image, then we display it side-to-side with inventory icon (in the same row of the infobox).
				ret = ret .. '|-\n'
				ret = ret .. '| style="vertical-align: middle; text-align: right" | [[File:' .. iconTitle.text .. ']]\n'
				ret = ret .. '| style="vertical-align: middle; text-align: left" | [[File:' .. blockImageTitle.text .. ']]\n'

				-- For Extension:OpenGraphMeta:
				-- because we didn't use {{infobox/image}}, we must call {{#setmainimage:}} explicitly.
				-- We use block image here, because it's larger than an icon.
				frame:callParserFunction( '#setmainimage', { blockImageTitle.text } )
			end
		end
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/title', args = { row.name } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/line', args = { row.description } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Category', row.category } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Tier', row.tier } }

	-- Item-specific properties like "Food value" must be shown higher than generic properties like "Price".
	local edibleByHuman = row.category == "food" or row.category == "preparedFood" or row.category == "drink"
	if edibleByHuman or row.category == "petFood" or metadata.foodValue then
		local foodValue = metadata.foodValue or 20 -- Some foods don't have foodValue key, but 20 is default

		local foodFieldName
		if edibleByHuman and not ( id:find( 'cattlefeed' ) == 1 or id:find( 'slew' ) == 1 ) then
			-- Human-edible food found.
			foodFieldName = '[[File:Rpb food icon.svg|16px|left|link=]] Food value'
		end

		if not foodFieldName then
			-- Animal-only food, e.g. Wheat or Algae.
			foodFieldName = '[[File:Nutrition (583) - The Noun Project.svg|24px|left|link=]] Farm beast food value'
			foodValue = foodValue .. '<br><small>(not edible by player! Only for farm beasts)</small>'
		end

		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { foodFieldName, foodValue } }
	end

	local primaryAbility = describeAbility( metadata, true )
	if primaryAbility then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = primaryAbility }
	end

	local altAbility = describeAbility( metadata, false )
	if altAbility then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = altAbility }
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Rarity', row.rarity } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Price', row.price } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Stack size', row.stackSize } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field/bool', args = { 'Two-handed?', row.twoHanded } }
	if row.upgradeable == '1' then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Upgradeable?', 'Yes' } }
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Tags', tagCloud( row.tags, 'ItemTag', nocat ) } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Colony tags', tagCloud( row.colonyTags, 'ColonyTag', nocat ) } }

	-- Item ID is last, because very few people need it
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'ID', row.id } }

	ret = ret .. '\n|}'
	return ret
end

return p
