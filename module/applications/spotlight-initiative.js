export class SpotlightInitiativeTracker {
	static ID = 'daggerheart.spotlight-initiative';

	static initialize() {
		Hooks.on('combatStart', this._onCombatStart.bind(this));
		Hooks.on('createCombat', this._onCreateCombat.bind(this));
		Hooks.on('renderCombatTracker', this._onRenderCombatTracker.bind(this));

		game.socket.on('module.daggerheart', this._handleSocketMessage.bind(this));
	}

	static _onCreateCombat(combat, options, userId) {
		if (game.user.isGM) {
			combat.setFlag('daggerheart-unofficial', 'spotlightRequests', {});
		}
	}

	static _onCombatStart(combat, updateData) {
		if (game.user.isGM) {
			combat.setFlag('daggerheart-unofficial', 'spotlightRequests', {});
		}
	}

	static async _onRenderCombatTracker(app, html, data) {
		if (!game.combat) return;

		const $html = $(html);

		const combatants = $html.find('.combatant');

		// Keep context menu button; remove only the round title
		$html.find('.encounter-title').remove();

		// Remove footer navigation buttons for rounds/turns
		const footer = $html.find('nav.combat-controls');
		footer
			.find(
				'[data-action="previousRound"], [data-action="nextRound"], [data-action="previousTurn"], [data-action="nextTurn"]'
			)
			.remove();

		// When context menu opens, remove only the "Reset Initiative" item
		$html
			.find('.encounter-context-menu')
			.off('click.spotlight')
			.on('click.spotlight', () => {
				setTimeout(() => {
					const $menus = $(document.body).find('.menu, .context-menu, .application.menu');
					$menus.each((i, menu) => {
						$(menu)
							.find('button, .menu-item, li, a')
							.filter((_, el) => (el.innerText || '').trim().toLowerCase().includes('reset initiative'))
							.remove();
					});
				}, 50);
			});

		combatants.each((i, el) => {
			const combatantId = el.dataset.combatantId;
			const combatant = game.combat.combatants.get(combatantId);
			if (!combatant) return;

			const controls = $(el).find('.combatant-controls');
			const initiativeSection = $(el).find('.token-initiative');
			initiativeSection.find('[data-action="rollInitiative"]').remove();
			initiativeSection
				.find('.give-spotlight, .approve-spotlight, .deny-spotlight, .ask-spotlight, .cancel-spotlight')
				.remove();

			if (game.user.isGM) {
				const giveSpotlightBtn = $(
					`<button type="button" class="combatant-control give-spotlight" title="Give Spotlight"><i class="fa-solid fa-hand-point-right"></i></button>`
				);
				giveSpotlightBtn.on('click', () => this._giveSpotlight(combatant));
				initiativeSection.append(giveSpotlightBtn);

				const requests = game.combat.getFlag('daggerheart-unofficial', 'spotlightRequests') || {};
				if (requests[combatantId]) {
					$(el).addClass('spotlight-requested');
					const approveBtn = $(
						`<button type="button" class="combatant-control approve-spotlight" title="Approve Spotlight Request"><i class="fa-solid fa-check"></i></button>`
					);
					const denyBtn = $(
						`<button type="button" class="combatant-control deny-spotlight" title="Deny Spotlight Request"><i class="fa-solid fa-xmark"></i></button>`
					);
					approveBtn.on('click', () => this._approveSpotlight(combatant));
					denyBtn.on('click', () => this._denySpotlight(combatant));
					giveSpotlightBtn.hide();
					initiativeSection.append(approveBtn);
					initiativeSection.append(denyBtn);
				}
			} else {
				const isOwner = combatant.isOwner;
				if (isOwner) {
					const requests = game.combat.getFlag('daggerheart-unofficial', 'spotlightRequests') || {};
					const hasRequested = requests[combatantId];

					if (hasRequested) {
						$(el).addClass('spotlight-requested');
						const cancelBtn = $(
							`<button type="button" class="combatant-control cancel-spotlight" title="Cancel Spotlight Request"><i class="fa-solid fa-hand"></i></button>`
						);
						cancelBtn.on('click', () => this._cancelSpotlight(combatant));
						initiativeSection.append(cancelBtn);
					} else {
						const askSpotlightBtn = $(
							`<button type="button" class="combatant-control ask-spotlight" title="Ask for Spotlight"><i class="fa-regular fa-hand"></i></button>`
						);
						askSpotlightBtn.on('click', () => this._askForSpotlight(combatant));
						initiativeSection.append(askSpotlightBtn);
					}
				}
			}

			if (combatant.id === game.combat.current?.combatantId) {
				$(el).addClass('active');
			}
		});
	}

	static async _giveSpotlight(combatant) {
		if (!game.user.isGM) return;

		const combat = game.combat;
		if (!combat) return;

		const currentTurn = combat.turns.indexOf(combatant);
		if (currentTurn === -1) return;

		await combat.update({ turn: currentTurn });

		ChatMessage.create({
			content: `<div class="spotlight-message">
        <i class="fa-solid fa-hand-point-right"></i>
        <strong>${combatant.name}</strong> has been given the spotlight!
      </div>`,
			speaker: { alias: ' ' },
		});
	}

	static async _askForSpotlight(combatant) {
		const combat = game.combat;
		if (!combat) return;

		// Send socket message to GM to update the flags
		game.socket.emit('module.daggerheart', {
			type: 'spotlightRequest',
			combatantId: combatant.id,
			combatantName: combatant.name,
			userId: game.user.id,
			combatId: combat.id,
		});

		ChatMessage.create({
			content: `<div class="spotlight-message">
        <i class="fa-regular fa-hand"></i>
        <strong>${combatant.name}</strong> is asking for the spotlight!
      </div>`,
			speaker: { alias: ' ' },
			whisper: game.users.filter(u => u.isGM).map(u => u.id),
		});
	}

	static async _cancelSpotlight(combatant) {
		const combat = game.combat;
		if (!combat) return;

		// Send socket message to GM to update the flags
		game.socket.emit('module.daggerheart', {
			type: 'cancelSpotlightRequest',
			combatantId: combatant.id,
			combatId: combat.id,
		});
	}

	static async _approveSpotlight(combatant) {
		if (!game.user.isGM) return;

		await this._giveSpotlight(combatant);
		await this._clearSpotlightRequest(combatant);
	}

	static async _denySpotlight(combatant) {
		if (!game.user.isGM) return;

		await this._clearSpotlightRequest(combatant);

		ChatMessage.create({
			content: `<div class="spotlight-message">
        <i class="fa-solid fa-xmark"></i>
        <strong>${combatant.name}</strong>'s spotlight request was denied.
      </div>`,
			speaker: { alias: ' ' },
		});
	}

	static async _clearSpotlightRequest(combatant) {
		const combat = game.combat;
		if (!combat) return;

		const requests = combat.getFlag('daggerheart-unofficial', 'spotlightRequests') || {};
		delete requests[combatant.id];

		await combat.setFlag('daggerheart-unofficial', 'spotlightRequests', requests);

		ui.combatTracker.render();
	}

	static async _handleSocketMessage(data) {
		if (!game.user.isGM) return;

		const combat = game.combats.get(data.combatId);
		if (!combat) return;

		if (data.type === 'spotlightRequest') {
			const requests = combat.getFlag('daggerheart-unofficial', 'spotlightRequests') || {};
			requests[data.combatantId] = {
				userId: data.userId,
				timestamp: Date.now(),
			};
			await combat.setFlag('daggerheart-unofficial', 'spotlightRequests', requests);
			ui.combatTracker.render();
		} else if (data.type === 'cancelSpotlightRequest') {
			const requests = combat.getFlag('daggerheart-unofficial', 'spotlightRequests') || {};
			delete requests[data.combatantId];
			await combat.setFlag('daggerheart-unofficial', 'spotlightRequests', requests);
			ui.combatTracker.render();
		}
	}
}

export class DaggerheartCombat extends Combat {
	async nextTurn() {
		return this.update({ turn: this.turn });
	}

	async previousTurn() {
		return this.update({ turn: this.turn });
	}

	_sortCombatants(a, b) {
		return 0;
	}

	// _updateTurnMarkers() {
	//   return;
	// }

	// _refreshTokenHUD(token, isActive) {
	//   return;
	// }
}
