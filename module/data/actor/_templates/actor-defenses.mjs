import { ModifiedNumberField } from '../_fields/modifier.mjs';

const { NumberField, SchemaField } = foundry.data.fields;
const { TypeDataModel } = foundry.abstract;

/**
 * Data model template with actor descriptions.
 *
 * @property {string} description    Full item description.
 * @mixin
 */
export class ActorDefensesData extends TypeDataModel {
	static defineSchema() {
		return {
			defenses: new SchemaField({
				'armor-slots': new SchemaField({
					max: new NumberField({
						min: 0,
						integer: true,
						required: true,
						positive: false,
						initial: 0,
					}),
					value: new NumberField({
						min: 0,
						integer: true,
						required: true,
						positive: false,
						initial: 0,
					}),
				}),

				armor: new ModifiedNumberField(),
				evasion: new ModifiedNumberField(),
			}),
		};
	}
}
