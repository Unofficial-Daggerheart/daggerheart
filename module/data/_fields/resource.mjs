const { NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for tracking resources.
 *
 * @property {string} id       // Resource ID.
 * @property {string} name     // Resource name.
 * @property {string} color    // Hex color value.
 *
 * @property {number} max      // Max resource tracker value.
 * @property {number} order    // Value used to sort resources.
 * @property {number} value    // Active resource tracker value.
 */
export class ResourceField extends SchemaField {
	constructor(options = {}, schemaOptions = {}) {
		const fields = {
			id: new StringField({
				blank: false,
				required: true,
			}),

			name: new StringField({
				blank: true,
				required: true,
				initial: options.name ?? 'Tracker',
			}),
			color: new StringField({
				blank: true,
				required: true,
				initial: options.color ?? '#f3c267',
			}),

			max: new NumberField({
				integer: true,
				required: false,
				positive: true,
				initial: options.max ?? 1,
			}),
			order: new NumberField({
				min: 0,
				integer: true,
				required: true,
				positive: false,
				initial: options.order ?? 0,
			}),
			value: new NumberField({
				min: 0,
				integer: true,
				required: true,
				positive: false,
				initial: options.value ?? 0,
			}),
		};
		super(fields, schemaOptions);
	}
}
