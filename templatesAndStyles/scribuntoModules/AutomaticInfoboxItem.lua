local p = {}
local cargo = mw.ext.cargo
local LinkBatch = require( 'Module:LinkBatch' )

-- Get HTML of pretty-printed list of tags.
-- @param {string} tagsString Comma-separated tags. Example: "ranged,tool,mininggun,mininglaser".
-- @param {string} categoryPrefix String between "Category:" and ":<tag here>" in links to categories. Example: "ColonyTag".
-- @param {bool} nocat If true, categories are not added to the page.
-- @return {table} { html = "resulting html", tags = { tag1 = true, tag2 = true, ... } }
local function tagCloud( tagsString, categoryPrefix, nocat )
	if not tagsString or tagsString == '' then
		return { html = '', tags = {} }
	end

	local tagsLine = ''
	local foundTags = {}
	for _, tag in ipairs( mw.text.split( tagsString, ',' ) ) do
		local category = 'Category:' .. categoryPrefix .. ':' .. tag

		-- TODO: move inline CSS into TemplateStyles or something
		tagsLine = tagsLine .. ' <span class="infobox-tag" style="border: 1px solid #7f7f7f; padding: 3px; display: inline-block; margin: 2px 1px;">[[:' ..
			category .. '|' .. tag .. ']]</span>'

		if not nocat then
			tagsLine = tagsLine .. '[[' .. category .. ']]'
		end

		foundTags[tag] = true
	end

	return { html = tagsLine, tags = foundTags }
end

-- Perform a SQL query to "item" table in the Cargo database (see Special:CargoTables/item).
-- @param {string} itemId
-- @return {table} Database row.
local function queryItem( itemId )
	local tables = 'item'
	local fields = 'name,description,category,tier,rarity,price,stackSize,twoHanded,wikiPage,id,tags,colonyTags'
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
			local tooltip = mw.getContentLanguage():ucfirst( damageType )
			fieldName = fieldName .. ' [[File:' .. damageTypeIcons[damageType] .. '|32px|' .. tooltip .. '|link=]]\n'
		else
			-- Unknown type, doesn't have an icon (yet?).
			ret = damageType .. "\n" .. ret
		end
	end

	return { fieldName, ret }
end

-- Based on item metadata, return wikitext that describes rotting status of this food.
-- @param {table} metadata Result of queryItemMetadata()
-- @return {string|nil}
function p.DescribeRotting( metadata )
	local rottingInfo, rotInfoColor
	if metadata.noRotting then
		rotInfoColor = 'green' -- Beneficial
		rottingInfo = 'This food doesn\'t rot.'
	elseif metadata.rotMinutes then
		local rotMinutes = tonumber( metadata.rotMinutes )

		rottingInfo = mw.getContentLanguage():formatDuration( 60 * rotMinutes )
		if rotMinutes > 200 then
			rotInfoColor = 'green' -- Better than default
		else
			rotInfoColor = '#bb0000' -- Worse than default
		end
	else
		return nil
	end

	return '<span style="font-weight: bold; color:' .. rotInfoColor .. '">' .. rottingInfo .. '</span>'
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
			ret = ret .. '[[Category:Item pages where title is different from expected]]'
		end

		ret = ret .. '\n'
	end

	-- Format "row" (information about item: row.name, row.description, etc.) as wikitext.
	ret = ret .. '{| class="infobox"\n'

	-- Check if there are images that can be added automatically.
	-- Most obtainable items have "File:Item_icon_<id>.png" (their 16x16 inventory icon).
	local foundImages = {}
	local normalizedId = string.gsub( row.id, ':', '.' )

	-- Possible image 1: Inventory icon.
	local iconTitle = mw.title.new( 'Item icon ' .. normalizedId .. '.png', 6 )
	if iconTitle.fileExists then
		table.insert( foundImages, iconTitle.text )
	end

	-- Possible image 2: image explicitly specified by a human editor (image=Something.png parameter).
	if image then
		table.insert( foundImages, image )
	end

	-- Possible image 3: depiction of placed blocks (3x3 grid). These are uploaded manually (not by the bot).
	if row.category == "block" then
		local blockImageTitle = mw.title.new( 'Block image ' .. normalizedId .. '.png', 6 )
		if blockImageTitle.fileExists then
			table.insert( foundImages, blockImageTitle.text )
		end
	end

	-- Possible image 4: image of placeable object, e.g. furniture. These are auto-uploaded by the bot.
	local placedImageTitle = mw.title.new( 'Item image ' .. normalizedId .. '.png', 6 )
	if placedImageTitle.fileExists then
		table.insert( foundImages, placedImageTitle.text )
	end

	if #foundImages > 0 then
		if #foundImages == 1 then
			-- If we only have one image, then it uses {{infobox/image}} (entire row of the infobox).
			local imageParams = { foundImages[1] }
			if args['image_size'] then
				imageParams['width'] = args['image_size']
			end
			ret = ret .. frame:expandTemplate{ title = 'infobox/image', args = imageParams }
		else
			-- If we have 2+ images (e.g. inventory icon and placeable image),
			-- then we display them side-to-side with inventory icon (in the same row of the infobox).
			-- Note: if we have 3 or more images, then only the first two are shown.
			ret = ret .. '|-\n'
			ret = ret .. '| style="vertical-align: middle; text-align: right" | [[File:' .. foundImages[1] .. ']]\n'
			ret = ret .. '| style="vertical-align: middle; text-align: left" | [[File:' .. foundImages[2]

			if args['image_size'] then
				-- Allow human editor to override the width of second image.
				-- First image is very likely an inventory icon and therefore doesn't need this.
				ret = ret .. '|' .. args['image_size']
			end
			ret = ret .. ']]\n'

			-- For Extension:OpenGraphMeta:
			-- because we didn't use {{infobox/image}}, we must call {{#setmainimage:}} explicitly.
			-- We use block image here, because it's larger than an icon.
			frame:callParserFunction( '#setmainimage', { foundImages[2] } )
		end
	end

	-- Remove "+N Fuel" from description, because we show "Ship fuel" as a separate row (see below).
	local description = string.gsub( row.description or '', '%s+%+%d+ Fuel', '' )

	ret = ret .. frame:expandTemplate{ title = 'infobox/title', args = { row.name } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/line', args = { description } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Category', row.category } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Tier', row.tier } }

	-- Item-specific properties like "Food value" must be shown higher than generic properties like "Price".
	local edibleByHuman = row.category == "food" or row.category == "preparedFood" or row.category == "drink"
	local animalDiet = metadata.whichAnimalsEat

	if edibleByHuman or animalDiet then
		-- Note: some foods don't have foodValue key.
		-- Default is 0 for player (buff foods that don't satisfy hunger) and 20 for farm beasts.
		local foodValue = metadata.foodValue

		if edibleByHuman and foodValue then
			ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
				'[[File:Rpb food icon.svg|16px|left|link=|alt=]] Food value',
				foodValue
			} }
		end

		if animalDiet then
			ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
				'[[File:Nutrition (583) - The Noun Project.svg|24px|left|link=|alt=]] Farm beast food value',
				( foodValue or 20 ) .. '<br><small>(' .. animalDiet .. ')</small>'
			} }
		end

		-- Display non-standard rotting time (values different from the default 3h20m).
		local rottingInfo = p.DescribeRotting( metadata )
		if rottingInfo then
			ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
				'[[List of foods by rotting time|Rotting]]', rottingInfo
			} }
		end
	end

	if metadata.shipFuel then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
			'[[File:Linearicons_rocket.svg|32px|left|link=|alt=]] [[Acceptable Ship Fuel|Ship fuel]]',
			metadata.shipFuel
		} }
	end

	if metadata.mechFuel then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
			'[[File:Node_icon_fu_engineering.mechsbasic.png|32px|left|link=|alt=]] [[Acceptable Mech Fuel|Mech fuel]]',
			metadata.mechFuel
		} }
	end

	if metadata.slotCount then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
			'[[File:Farm-Fresh box open.png|32px|left|link=|alt=]] Slot count',
			metadata.slotCount
		} }
	end

	if metadata.blockHealth then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
			'[[File:Noun project 528.svg|16px|left|link=|alt=]] [[List of blocks by durability|Block hitpoints]]',
			metadata.blockHealth
		} }
	end

	if metadata.lightLevel and metadata.lightColor then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
			'[[List of lights|Light]]',
			metadata.lightLevel .. ' ' .. frame:expandTemplate{ title = 'LightColor', args = { metadata.lightColor } }
		} }
	end

	if metadata.tileEffects then
		local effects = mw.text.split( metadata.tileEffects, ',' )
		for _, effectCode in ipairs( effects ) do
			LinkBatch.AddEffect( effectCode )
		end

		local effectLinks = {}
		for _, effectCode in ipairs( effects ) do
			table.insert( effectLinks, LinkBatch.GetEffectLink( effectCode, {
				nolink = true,
				icon = 'ifExists',
				allowUnknown = true
			} ) .. '[[Category:TileEffect:' .. effectCode .. ']]' )
		end

		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = {
			'[[File:VisualEditor - Icon - Alert.svg|16px|left|link=|alt=]] Effects',
			table.concat( effectLinks, '\n' )
		} }
	end

	local primaryAbility = describeAbility( metadata, true )
	if primaryAbility then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = primaryAbility }
	end

	local altAbility = describeAbility( metadata, false )
	if altAbility then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = altAbility }
	end

	if metadata.powerMultiplier and metadata.protection and metadata.maxEnergy and metadata.maxHealth then
		-- Armor
		local bonus = '[[File:Damage icon.png|24px|link=|Damage]] ' .. metadata.powerMultiplier .. '%' ..
			'\n\n[[File:Defence icon.png|24px|link=|Defense]] ' .. metadata.protection ..
			'\n\n[[File:Energy icon.png|24px|link=|Energy]] ' .. metadata.maxEnergy ..
			'\n\n[[File:Health icon.png|24px|link=|Health]] ' .. metadata.maxHealth

		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Bonus', bonus } }

		-- What other armor pieces are necessary for this set? (usually 3 items: head/chest/legs)
		local setQueryFields = 'headPage__full=head,chestPage__full=chest,legsPage__full=legs'
		local setQueryOpt = {
			where = 'head HOLDS "' .. id .. '" OR chest HOLDS "' .. id .. '" OR legs HOLDS "' .. id .. '"',
			limit = 1
		}
		local setRow = ( cargo.query( 'armorset', setQueryFields, setQueryOpt ) or {} )[1]

		if setRow then
			local armorset = ''

			if setRow.head ~= '' then
				for _, linkTarget in ipairs( mw.text.split( setRow.head, ',' ) ) do
					armorset = armorset .. '[[File:Museum icon Military.png|head|16px|link=]] [[' .. linkTarget .. ']]<br>'
				end
			end

			if setRow.chest ~= '' then
				for _, linkTarget in ipairs( mw.text.split( setRow.chest, ',' ) ) do
					armorset = armorset .. '[[File:Rpb clothing icon.svg|chest|16px|link=]] [[' .. linkTarget .. ']]<br>'
				end
			end

			if setRow.legs ~= '' then
				for _, linkTarget in ipairs( mw.text.split( setRow.legs, ',' ) ) do
					armorset = armorset .. '[[File:Android Emoji 1f45f.svg|legs|16px|link=]] [[' .. linkTarget .. ']]<br>'
				end
			end

			ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'In set with', armorset } }
		end
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Rarity', row.rarity } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Price', row.price } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Stack size', row.stackSize } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field/bool', args = { 'Two-handed?', row.twoHanded } }

	local itemTagCloud = tagCloud( row.tags, 'ItemTag', nocat )
	if itemTagCloud.tags.upgradeableWeapon or itemTagCloud.tags.upgradeableTool then
		ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Upgradeable?', 'Yes' } }
	end

	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Tags', itemTagCloud.html } }
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'Colony tags', tagCloud( row.colonyTags, 'ColonyTag', nocat ).html } }

	-- Item ID is last, because very few people need it
	ret = ret .. frame:expandTemplate{ title = 'infobox/field', args = { 'ID', row.id } }

	ret = ret .. '\n|}\n' .. frame:expandTemplate{ title = 'Item unlocked by', args = { row.id } }

	-- For codexes only: add a top-level ==Section== with text, prepended by {{Spoiler}} template
	if row.category == 'codex' then
		local codexRow = ( cargo.query( 'codex_text', 'text', { where = 'id="' .. id .. '"' } ) or {} )[1]
		if codexRow then
			ret = ret .. frame:expandTemplate{ title = 'Spoiler', args = { nocat = 1 } } ..
				'\n== Contents ==\n' ..
				frame:expandTemplate{ title = 'Codex', args = { text = codexRow.text } }
		end
	end

	return ret
end

return p
