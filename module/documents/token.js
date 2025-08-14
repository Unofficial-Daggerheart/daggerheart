/**
 * Extend the base TokenDocument to support resource type attributes.
 * @extends {TokenDocument}
 */
export class SimpleTokenDocument extends TokenDocument {
	/** @inheritdoc */
	getBarAttribute(barName, { alternative } = {}) {
		const data = super.getBarAttribute(barName, { alternative });
		const attr = alternative || this[barName]?.attribute;
		if (!data || !attr || !this.actor) return data;
		const current = foundry.utils.getProperty(this.actor.system, attr);
		if (current?.dtype === 'Resource') data.min = parseInt(current.min || 0);
		data.editable = true;
		return data;
	}

	/* -------------------------------------------- */

	static getTrackedAttributes(data, _path = []) {
		if (data || _path.length) return super.getTrackedAttributes(data, _path);
		data = {};
		// Bail if no actor is assigned
		if (!game?.system?.model?.Actor) {
			return super.getTrackedAttributes(data);
		}
		for (const model of Object.values(game.system.model.Actor)) {
			foundry.utils.mergeObject(data, model);
		}
		for (const actor of game.actors) {
			if (actor.isTemplate) foundry.utils.mergeObject(data, actor.toObject());
		}
		return super.getTrackedAttributes(data);
	}

	static getTrackedAttributeChoices(attributes) {
		const data = super.getTrackedAttributeChoices(attributes);
		data.forEach(entry => {
			switch (entry.value) {
				case 'hope':
					entry.label = game.i18n.localize('DH.Hope');
					break;
				case 'armor':
					entry.label = game.i18n.localize('DH.Armor');
					break;
				case 'stress':
					entry.label = game.i18n.localize('DH.Stress');
					break;
				case 'health':
					entry.label = game.i18n.localize('DH.Health');
					break;
				case 'hopeBar':
					entry.label = game.i18n.localize('DH.HopeBar');
					break;
				case 'armorBar':
					entry.label = game.i18n.localize('DH.ArmorBar');
					break;
				case 'stressBar':
					entry.label = game.i18n.localize('DH.StressBar');
					break;
				case 'healthBar':
					entry.label = game.i18n.localize('DH.HealthBar');
					break;
				default:
					console.warn('Daggerheart Token: unkown attribute label');
					break;
			}
		});
		return data;
	}
}

/* -------------------------------------------- */

/**
 * Extend the base Token class to implement additional system-specific logic.
 * @extends {Token}
 */
export class SimpleToken extends foundry.canvas.placeables.Token {
	_drawBar(number, bar, data) {
		if ('min' in data) {
			// copy data
			data = { ...data };
			// Shift the value and max by the min to draw the bar percentage accurately for a non-zero min
			data.value -= data.min;
			data.max -= data.min;
		}
		return super._drawBar(number, bar, data);
	}
}
