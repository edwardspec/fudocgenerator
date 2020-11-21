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
	local tables = 'item'
	local fields = 'name,description,category,tier,rarity,price,stackSize,twoHanded,upgradeable,wikiPage,id,tags,colonyTags'
	local queryOpt = {
		where = 'item.id="' .. id .. '"',
		limit = 1
	}
	local row = ( cargo.query( tables, fields, queryOpt ) or {} )[1]
	if not row then
		-- Item not found in the database.
		if nocat then
			return ''
		end
		return '[[Category:Item pages with broken automatic infobox]]'
	end

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
