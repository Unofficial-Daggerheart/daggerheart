// Removed tooltip links on:
// system.health.tooltip
// system.stress.tooltip
//
// system.hope.tooltip
// system.level.tooltip
// system.proficiency.tooltip
//
// system.agility.tooltip
// system.strength.tooltip
// system.finesse.tooltip
// system.instinct.tooltip
// system.presence.tooltip
// system.knowledge.tooltip
//
// system.defenses.armor.tooltip
// system.defenses.evasion.tooltip
// system.defenses.armor-slots.tooltip
//
// system.treasure.bags.tooltip
// system.treasure.coins.tooltip
// system.treasure.chests.tooltip
// system.treasure.handfuls.tooltip

import { ActorBase } from '../_base/actor-base.mjs';

import { ValueField } from './_fields/value.mjs';
import { WeaponSlotField } from './_fields/weapon-slot.mjs';
import { ModifiedNumberField, LeveledModifierField } from './_fields/modifier.mjs';

import { ActorTrackerData } from './_templates/actor-tracker.mjs';
import { ActorDefensesData } from './_templates/actor-defenses.mjs';
import { ActorExperienceData } from './_templates/actor-experience.mjs';
import { ActorDescriptionData } from './_templates/actor-description.mjs';
import { ActorAdvancementsData } from './_templates/actor-advancements.mjs';

const { ArrayField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

export default class CharacterData extends ActorBase.mixin(
	ActorTrackerData,
	ActorDefensesData,
	ActorExperienceData,
	ActorDescriptionData,
	ActorAdvancementsData
) {
	static defineSchema() {
		return this.mergeSchema(super.defineSchema(), {
			hope: new ValueField({ min: 0, max: 6, value: 2 }),

			// TODO Combine these with the Description
			age: new StringField({
				blank: true,
				required: true,
				initial: "6",
			}),
			pronouns: new StringField({
				blank: true,
				required: true,
			}),
			residence: new StringField({
				blank: true,
				required: true,
			}),
			nationality: new StringField({
				blank: true,
				required: true,
			}),

			health: new ValueField({ max: 6 }),
			stress: new ValueField({ max: 6 }),

			level: new ValueField({ min: 1, max: 10, value: 1 }),
			proficiency: new ValueField({ min: 1, max: 10, value: 1 }),

			agility: new LeveledModifierField({ min: -5, positive: false }),
			strength: new LeveledModifierField({ min: -5, positive: false }),
			finesse: new LeveledModifierField({ min: -5, positive: false }),
			instinct: new LeveledModifierField({ min: -5, positive: false }),
			presence: new LeveledModifierField({ min: -5, positive: false }),
			knowledge: new LeveledModifierField({ min: -5, positive: false }),

			'weapon-off': new WeaponSlotField(),
			'weapon-main': new WeaponSlotField(),

			chosenDomains: new SchemaField({
				'domain-one': new StringField({
					blank: true,
					required: true,
				}),
				'domain-two': new StringField({
					blank: true,
					required: true,
				}),
			}),

			threshold: new SchemaField({
				major: new ModifiedNumberField(),
				severe: new ModifiedNumberField(),
			}),

			treasure: new SchemaField({
				coins: new SchemaField({
					value: new NumberField({
						min: 0,
						integer: true,
						required: true,
						positive: false,
					}),
				}),
				handfuls: new SchemaField({
					value: new NumberField({
						min: 0,
						integer: true,
						required: true,
						positive: false,
					}),
				}),
				bags: new SchemaField({
					value: new NumberField({
						min: 0,
						integer: true,
						required: true,
						positive: false,
					}),
				}),
				chests: new SchemaField({
					value: new NumberField({
						min: 0,
						integer: true,
						required: true,
						positive: false,
					}),
				}),
			}),

			// TODO: Delete these? Items are the inventory
			// They remain from the original template file.
			domains: new ArrayField(new ObjectField()),
			features: new ArrayField(new ObjectField()),
			inventory: new StringField({
				blank: true,
				required: true,
			}),
			backpack: new SchemaField({
				items: new ArrayField(new ObjectField()),
			}),
		});
	}
}
