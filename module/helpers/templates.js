const { handlebars } = foundry.applications;

export const path = 'systems/daggerheart-unofficial/templates';

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const loadTemplates = async function () {
	// Define template paths to load
	const templatePaths = [
		`${path}/parts/sheet-attributes.html`,
		`${path}/parts/sheet-groups.html`,
		`${path}/parts/npc-weapons.html`,
		`${path}/views/sheets/item-base.hbs`,
		`${path}/partials/sheets/panel-menu.hbs`,
		`${path}/partials/sheets/panel-resources.hbs`,
	];

	// Load the template parts
	return handlebars.loadTemplates(templatePaths);
};

/**
 * Define a set of template paths to register as partials.
 * Partials can be used within other templates and makes them reusable
 * @return {Promise}
 */
export const registerPartials = async function () {
	// used in next update for panel templates
};
