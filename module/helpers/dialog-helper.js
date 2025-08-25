import {
	createEmptyAdvantageSet,
	normalizeAdvantageData,
	calculateFinalDice,
	generateAdvantageFormula,
	addDice,
	removeDice,
	getAdvantageDescription,
	calculateNetResult,
} from './advantage-manager.js';

export class DaggerheartDialogHelper {
	static async showDialog(config) {
		const dialogClass = `daggerheart-dialog ${config.dialogClass || ''}`;
		return new Promise(resolve => {
			let isResolved = false;
			const safeResolve = value => {
				if (!isResolved) {
					isResolved = true;
					resolve(value);
				}
			};

			const buttonsArray = [];
			const defaultKey = config.default || Object.keys(config.buttons || {})[0];
			for (const [key, button] of Object.entries(config.buttons || {})) {
				buttonsArray.push({
					action: key,
					label: button.label,
					default: key === defaultKey,
					callback: (event, btn, dialog) => {
						const html = $(dialog.window.content);
						const result = button.callback ? button.callback(html) : { html, button: key };
						safeResolve(result);
					},
				});
			}

			const dlg = new foundry.applications.api.DialogV2({
				window: { title: config.title },
				content: config.content,
				buttons: buttonsArray,
				classes: [dialogClass],
				submit: result => {
					safeResolve(result);
				},
			});

			dlg.addEventListener('close', () => safeResolve(null));
			if (config.render) {
				dlg.addEventListener(
					'render',
					() => {
						const html = $(dlg.window.content);
						config.render(html);
					},
					{ once: true }
				);
			}

			dlg.render({ force: true });
		});
	}

	static async showCheckboxDialog(config) {
		const content = `
      <form>
        <div class="daggerheart-dialog-content">
          ${config.description ? `<p class="dialog-description">${config.description}</p>` : ''}
          <div class="checkbox-group">
            ${config.options
							.map(
								option => `
              <div class="checkbox-item">
                <input type="${config.singleSelect ? 'radio' : 'checkbox'}"
                       id="${option.id}"
                       name="${config.singleSelect ? 'selection' : option.id}"
                       value="${option.value || option.id}"
                       ${option.checked ? 'checked' : ''}>
                <label for="${option.id}">
                  <strong>${option.label}</strong>
                  ${option.description ? `<span class="option-description">${option.description}</span>` : ''}
                </label>
              </div>
            `
							)
							.join('')}
          </div>
        </div>
      </form>
    `;

		const result = await this.showDialog({
			title: config.title,
			content,
			dialogClass: 'checkbox-dialog',
			buttons: {
				confirm: {
					label: config.confirmLabel || 'Confirm',
					icon: '<i class="fas fa-check"></i>',
					callback: html => {
						if (config.singleSelect) {
							const selectedInput = html.find('input[type="radio"]:checked');
							const selected = selectedInput.length > 0 ? selectedInput.val() : null;
							return { html, button: 'confirm', selected };
						} else {
							const selected = {};
							html.find('input[type="checkbox"]:checked').each((i, el) => {
								selected[el.id] = true;
							});
							return { html, button: 'confirm', selected };
						}
					},
				},
				cancel: {
					label: 'Cancel',
					callback: () => null,
				},
			},
		});

		return result;
	}

	static async showDeathMoveDialog(characterName, actor) {
		const options = [
			{ id: 'blaze-of-glory', label: 'Blaze of Glory', value: 'Blaze of Glory' },
			{ id: 'avoid-death', label: 'Avoid Death', value: 'Avoid Death' },
			{ id: 'risk-it-all', label: 'Risk it All', value: 'Risk it All' },
		];

		const result = await this.showCheckboxDialog({
			title: `Death Move - ${characterName}`,
			description: "Choose your character's death move:",
			options,
			singleSelect: true,
			confirmLabel: 'Choose Death Move',
		});

		if (result && result.selected) {
			await ChatMessage.create({
				content: `<p><em>${characterName} has chosen ${result.selected} as their Death Move.</em></p>`,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
			});

			if (result.selected === 'Blaze of Glory') {
				if (game.daggerheart?.rollHandler?.enableForcedCritical) {
					game.daggerheart.rollHandler.enableForcedCritical();

					await ChatMessage.create({
						content: `
              <div class="death-move-blaze">
                <p><strong>${characterName} goes out in a Blaze of Glory!</strong></p>
                <p><em>Their next roll will be a Critical Success, but this heroic act will cost them their life.</em></p>
              </div>
            `,
						speaker: ChatMessage.getSpeaker({ actor }),
						type: CONST.CHAT_MESSAGE_TYPES.OTHER,
						flags: {
							'uo-msg': {
								deathMove: 'blaze-of-glory',
								characterName: characterName,
							},
						},
					});

					Hooks.once('daggerheart.dualityRollComplete', async rollData => {
						if (rollData.isCrit && rollData.forcedCritical) {
							await ChatMessage.create({
								content: `
                  <div class="death-move-blaze-complete">
                    <p><strong>${characterName}'s heroic sacrifice is complete.</strong></p>
                    <p><em>With their final breath, they achieved the impossible. Their name will be remembered in legend.</em></p>
                  </div>
                `,
								speaker: ChatMessage.getSpeaker({ actor }),
								type: CONST.CHAT_MESSAGE_TYPES.OTHER,
								flags: {
									'uo-msg': {
										deathMove: 'blaze-of-glory-complete',
										characterName: characterName,
									},
								},
							});
						}
					});
				} else {
					ui.notifications.error('Roll handler not available. Please ensure the system is properly initialized.');
					return null;
				}
			} else if (result.selected === 'Avoid Death') {
				if (!actor) {
					ui.notifications.error('No actor provided for Avoid Death roll.');
					return null;
				}

				await ChatMessage.create({
					content: `
            <div class="death-move-avoid">
              <p><strong>${characterName} struggles to Avoid Death!</strong></p>
              <p><em>They fall unconscious, clinging to life...</em></p>
            </div>
          `,
					speaker: ChatMessage.getSpeaker({ actor }),
					type: CONST.CHAT_MESSAGE_TYPES.OTHER,
					flags: {
						'uo-msg': {
							deathMove: 'avoid-death',
							characterName: characterName,
						},
					},
				});

				const characterLevel = actor.system.level?.value || 1;

				if (game.daggerheart?.rollHandler?.rollHope) {
					const hopeResult = await game.daggerheart.rollHandler.rollHope({
						sendToChat: false,
						returnRoll: false,
					});

					const hopeValue = hopeResult.dieValue;
					const gainsScar = hopeValue <= characterLevel;

					let flavorText = `
            <div class="death-move-avoid-result">
              <p><strong>Avoid Death Roll</strong></p>
              <p>Hope Die: <strong>${hopeValue}</strong> vs Level: <strong>${characterLevel}</strong></p>
          `;

					if (gainsScar) {
						flavorText += `
              <p class="scar-gained"><em>${characterName} gains a scar from their near-death experience.</em></p>
              <p class="scar-note">The character survives but is forever marked by this ordeal.</p>
            </div>
            `;
					} else {
						flavorText += `
              <p class="scar-avoided"><em>${characterName} miraculously avoids permanent scarring!</em></p>
              <p class="scar-note">They recover without lasting physical marks, though the memory remains.</p>
            </div>
            `;
					}

					try {
						const avoidMessage = await ChatMessage.create({
							content: `
                <div class="dice-roll">
                  <div class="dice-result">
                    <div class="dice-formula">${hopeResult.roll.formula}</div>
                    <div class="dice-total">${hopeResult.roll.total}</div>
                  </div>
                </div>
              `,
							speaker: ChatMessage.getSpeaker({ actor }),
							flavor: flavorText,
							type: CONST.CHAT_MESSAGE_TYPES.ROLL,
							rolls: [hopeResult.roll],
							flags: {
								'uo-msg': {
									deathMove: 'avoid-death-roll',
									characterName: characterName,
									gainsScar: gainsScar,
									hopeValue: hopeValue,
									characterLevel: characterLevel,
								},
							},
						});

						if (avoidMessage?.id && game.daggerheart?.rollHandler?._waitFor3dDice) {
							await game.daggerheart.rollHandler._waitFor3dDice(avoidMessage.id);
						}
					} catch (error) {
						console.error('Error creating death move avoid roll chat message:', error);
						ui.notifications.warn('Chat message failed to send, but roll was completed.');
					}

					if (gainsScar) {
						ui.notifications.info(
							`${characterName} gains a scar. Scar functionality will be implemented in the future.`
						);
					}
				} else {
					ui.notifications.error('Roll handler not available for Avoid Death roll.');
					return null;
				}
			} else if (result.selected === 'Risk it All') {
				if (!actor) {
					ui.notifications.error('No actor provided for Risk it All roll.');
					return null;
				}

				await ChatMessage.create({
					content: `
            <div class="death-move-risk">
              <p><strong>${characterName} chooses to Risk it All!</strong></p>
              <p><em>Everything hangs in the balance of this single roll...</em></p>
            </div>
          `,
					speaker: ChatMessage.getSpeaker({ actor }),
					type: CONST.CHAT_MESSAGE_TYPES.OTHER,
					flags: {
						'uo-msg': {
							deathMove: 'risk-it-all',
							characterName: characterName,
						},
					},
				});

				if (game.daggerheart?.rollHandler?.rollDuality) {
					const dualityResult = await game.daggerheart.rollHandler.rollDuality({
						sendToChat: false,
						returnRoll: false,
					});
					console.log(game.daggerheart.rollHandler);

					const { hopeDieValue, fearDieValue, isCrit } = dualityResult;
					const hopeWins = hopeDieValue > fearDieValue;
					const fearWins = hopeDieValue < fearDieValue;

					if (isCrit) {
						const updateData = {
							'system.health.value': 0,
							'system.stress.value': 0,
						};

						await actor.update(updateData);

						try {
							const criticalMessage = await ChatMessage.create({
								content: `
                  <div class="dice-roll">
                    <div class="dice-result">
                      <div class="dice-formula">${dualityResult.roll.formula}</div>
                      <div class="dice-total">${dualityResult.roll.total}</div>
                    </div>
                  </div>
                `,
								speaker: ChatMessage.getSpeaker({ actor }),
								flavor: `
                  <div class="death-move-risk-critical">
                    <p><strong>Risk it All - CRITICAL SUCCESS!</strong></p>
                    <p>Hope: <strong>${hopeDieValue}</strong> | Fear: <strong>${fearDieValue}</strong></p>
                    <p class="miracle"><em>${characterName} achieves the impossible!</em></p>
                    <p class="full-heal">Complete restoration: HP and Stress set to 0!</p>
                  </div>
                `,
								type: CONST.CHAT_MESSAGE_TYPES.ROLL,
								rolls: [dualityResult.roll],
								flags: {
									'uo-msg': {
										deathMove: 'risk-it-all-critical',
										characterName: characterName,
										hopeDieValue: hopeDieValue,
										fearDieValue: fearDieValue,
									},
								},
							});

							if (criticalMessage?.id && game.daggerheart?.rollHandler?._waitFor3dDice) {
								await game.daggerheart.rollHandler._waitFor3dDice(criticalMessage.id);
							}
						} catch (error) {
							console.error('Error creating death move critical chat message:', error);
							ui.notifications.warn('Chat message failed to send, but roll was completed.');
						}

						ui.notifications.info(`${characterName} achieves miraculous recovery!`);
					} else if (hopeWins) {
						try {
							const hopeMessage = await ChatMessage.create({
								content: `
                  <div class="dice-roll">
                    <div class="dice-result">
                      <div class="dice-formula">${dualityResult.roll.formula}</div>
                      <div class="dice-total">${dualityResult.roll.total}</div>
                    </div>
                  </div>
                `,
								speaker: ChatMessage.getSpeaker({ actor }),
								flavor: `
                  <div class="death-move-risk-hope">
                    <p><strong>Risk it All - Hope Prevails!</strong></p>
                    <p>Hope: <strong>${hopeDieValue}</strong> | Fear: <strong>${fearDieValue}</strong></p>
                    <p class="recovery-available"><em>${characterName} can recover ${hopeDieValue} points!</em></p>
                  </div>
                `,
								type: CONST.CHAT_MESSAGE_TYPES.ROLL,
								rolls: [dualityResult.roll],
								flags: {
									'uo-msg': {
										deathMove: 'risk-it-all-hope',
										characterName: characterName,
										hopeDieValue: hopeDieValue,
										fearDieValue: fearDieValue,
									},
								},
							});

							if (hopeMessage?.id && game.daggerheart?.rollHandler?._waitFor3dDice) {
								await game.daggerheart.rollHandler._waitFor3dDice(hopeMessage.id);
							}
						} catch (error) {
							console.error('Error creating death move hope chat message:', error);
							ui.notifications.warn('Chat message failed to send, but roll was completed.');
						}

						const recoveryChoice = await this.showRecoveryAllocationDialog({
							characterName: characterName,
							availablePoints: hopeDieValue,
							currentHP: actor.system.health?.value || 0,
							currentStress: actor.system.stress?.value || 0,
							maxHP: actor.system.health?.max || 10,
							maxStress: actor.system.stress?.max || 10,
						});

						if (recoveryChoice && recoveryChoice.button === 'confirm') {
							const hpHealing = recoveryChoice.hpHealing || 0;
							const stressHealing = recoveryChoice.stressHealing || 0;

							const newHP = Math.max(0, (actor.system.health?.value || 0) - hpHealing);
							const newStress = Math.max(0, (actor.system.stress?.value || 0) - stressHealing);

							const updateData = {
								'system.health.value': newHP,
								'system.stress.value': newStress,
							};

							await actor.update(updateData);

							await ChatMessage.create({
								content: `
                  <div class="death-move-risk-recovery">
                    <p><strong>${characterName}'s Recovery</strong></p>
                    <p>HP healed: <strong>${hpHealing}</strong> | Stress cleared: <strong>${stressHealing}</strong></p>
                    <p class="recovery-result"><em>Against all odds, they pull through!</em></p>
                  </div>
                `,
								speaker: ChatMessage.getSpeaker({ actor }),
								type: CONST.CHAT_MESSAGE_TYPES.OTHER,
								flags: {
									'uo-msg': {
										deathMove: 'risk-it-all-recovery',
										characterName: characterName,
										hpHealing: hpHealing,
										stressHealing: stressHealing,
									},
								},
							});
						}
					} else if (fearWins) {
						try {
							const deathMessage = await ChatMessage.create({
								content: `
                  <div class="dice-roll">
                    <div class="dice-result">
                      <div class="dice-formula">${dualityResult.roll.formula}</div>
                      <div class="dice-total">${dualityResult.roll.total}</div>
                    </div>
                  </div>
                `,
								speaker: ChatMessage.getSpeaker({ actor }),
								flavor: `
                  <div class="death-move-risk-death">
                    <p><strong>Risk it All - Fear Claims Victory</strong></p>
                    <p>Hope: <strong>${hopeDieValue}</strong> | Fear: <strong>${fearDieValue}</strong></p>
                    <p class="final-words"><em>${characterName}'s gamble has failed...</em></p>
                    <p class="death-result">The ultimate risk has claimed their life.</p>
                  </div>
                `,
								type: CONST.CHAT_MESSAGE_TYPES.ROLL,
								rolls: [dualityResult.roll],
								flags: {
									'uo-msg': {
										deathMove: 'risk-it-all-death',
										characterName: characterName,
										hopeDieValue: hopeDieValue,
										fearDieValue: fearDieValue,
									},
								},
							});

							if (deathMessage?.id && game.daggerheart?.rollHandler?._waitFor3dDice) {
								await game.daggerheart.rollHandler._waitFor3dDice(deathMessage.id);
							}
						} catch (error) {
							console.error('Error creating death move death chat message:', error);
							ui.notifications.warn('Chat message failed to send, but roll was completed.');
						}

						ui.notifications.warn(`${characterName} has paid the ultimate price.`);
					}
				} else {
					ui.notifications.error('Roll handler not available for Risk it All roll.');
					return null;
				}
			} else {
				ui.notifications.info(`Death Move selected: ${result.selected}. Functionality will come in the future.`);
			}

			return result.selected;
		}

		return null;
	}

	static async showDualityRollDialog(config = {}) {
		const { title = 'Roll', rollDetails = {}, actor = null } = config;

		const defaults = {
			hopeDieSize: 'd12',
			fearDieSize: 'd12',
			advantage: createEmptyAdvantageSet(),
			disadvantage: createEmptyAdvantageSet(),
			modifier: 0,
			messageType: 'public',
		};

		const normalizedRollDetails = {
			...rollDetails,
			advantage: normalizeAdvantageData(rollDetails.advantage),
			disadvantage: normalizeAdvantageData(rollDetails.disadvantage),
		};

		const initialValues = { ...defaults, ...normalizedRollDetails };

		let experienceSection = '';
		if (actor && actor.type === 'character' && actor.system?.experience) {
			const expData = actor.system.experience;

			const expEntries = Object.keys(expData)
				.filter(k => /Mod\d*$/.test(k))
				.map(k => {
					const modValue = parseInt(expData[k]) || 0;
					const nameKey = k.replace('Mod', 'Name');
					const nameValue = (expData[nameKey] || `Experience`).trim();
					return { key: k, label: nameValue, mod: modValue };
				})

				.filter(entry => entry.mod !== 0);

			if (expEntries.length > 0) {
				experienceSection += `
        <div class="flex-col" style="gap:0.5rem; width:100%;">
          <span class="label-bar">Experience</span>
          <div class="exp-table" style="display:flex;flex-direction:column;gap:0.25rem; width:100%;">`;

				expEntries.forEach((exp, idx) => {
					const checkedId = `expChk_${idx}`;
					experienceSection += `
            <label class="exp-row" style="display:flex;align-items:center;gap:0.5rem;width:100%;">
              <input type="checkbox" class="exp-checkbox" data-mod="${exp.mod}" id="${checkedId}" />
              <span class="exp-name" style="flex:1;">${exp.label}</span>
              <span class="exp-mod" style="min-width:2rem;text-align:right;">${exp.mod >= 0 ? '+' : ''}${exp.mod}</span>
            </label>`;
				});

				experienceSection += `</div></div>`;
			}
		}

		const allowedDice = (game.settings.get('daggerheart-unofficial', 'advantageDieTypes') || 'd6').split(',');
		const diceControls = allowedDice
			.map(
				die => `
      <div class="dice-control" data-die="${die}">
        <button type="button" class="dice-btn increase" data-type="advantage" data-die="${die}"><i class="fas fa-plus"></i></button>
        <div class="dice-icon ${die}-icon">
          <i class="fad fa-dice-${[die]}"></i>
          <span class="dice-count">${initialValues.advantage[die] - initialValues.disadvantage[die]}</span>
        </div>
        <button type="button" class="dice-btn decrease" data-type="advantage" data-die="${die}"><i class="fas fa-minus"></i></button>
        <input type="hidden" name="advantage-${die}" value="${initialValues.advantage[die] - initialValues.disadvantage[die]}">
      </div>
    `
			)
			.join('');

		const content = `
    <form>
    <div class="flex-col" style="align-items: stretch; gap: 2rem">
        <div class="flex-row" style="justify-content: center; gap: 2rem;">
            <div class="flex-col">
                <span class="label-bar">Hope Die</span>
                <select name="hopeDieSize" id="hopeDieSize">
                    <option value="d4" ${initialValues.hopeDieSize === 'd4' ? 'selected' : ''}>d4</option>
                    <option value="d6" ${initialValues.hopeDieSize === 'd6' ? 'selected' : ''}>d6</option>
                    <option value="d8" ${initialValues.hopeDieSize === 'd8' ? 'selected' : ''}>d8</option>
                    <option value="d10" ${initialValues.hopeDieSize === 'd10' ? 'selected' : ''}>d10</option>
                    <option value="d12" ${initialValues.hopeDieSize === 'd12' || !initialValues.hopeDieSize ? 'selected' : ''}>d12</option>
                    <option value="d20" ${initialValues.hopeDieSize === 'd20' ? 'selected' : ''}>d20</option>
                </select>
            </div>
            <div class="flex-col">
                <span class="label-bar">Fear Die</span>
                <select name="fearDieSize" id="fearDieSize">
                    <option value="d4" ${initialValues.fearDieSize === 'd4' ? 'selected' : ''}>d4</option>
                    <option value="d6" ${initialValues.fearDieSize === 'd6' ? 'selected' : ''}>d6</option>
                    <option value="d8" ${initialValues.fearDieSize === 'd8' ? 'selected' : ''}>d8</option>
                    <option value="d10" ${initialValues.fearDieSize === 'd10' ? 'selected' : ''}>d10</option>
                    <option value="d12" ${initialValues.fearDieSize === 'd12' || !initialValues.fearDieSize ? 'selected' : ''}>d12</option>
                    <option value="d20" ${initialValues.fearDieSize === 'd20' ? 'selected' : ''}>d20</option>
                </select>
            </div>
        </div>
      <div class="flex-col">
        <span class="label-bar">Advantage / Disadvantage</span>
        <div class="dice-grid advantage-disadvantage-grid">
          ${diceControls}
        </div>
      </div>
      <div class="flex-row">
        <div class="flex-col stepper-group">
          <span class="label-bar">Flat Modifier</span>
          <div class="flex-row">
            <button id="mod-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="dualityDiceModifierInput" autofocus name="modifier" step="1" type="number" value="${initialValues.modifier}"/>
            <button id="mod-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
      </div>
      ${experienceSection}
      <div class="flex-col">
        <span class="label-bar">Message Type</span>
        <div class="message-type-selection">
          <label class="message-type-option">
            <input type="radio" name="messageType" value="public" ${initialValues.messageType === 'public' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-globe"></i>
              <span>Public</span>
            </span>
          </label>
          <label class="message-type-option">
            <input type="radio" name="messageType" value="blind" ${initialValues.messageType === 'blind' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-eye-slash"></i>
              <span>Blind</span>
            </span>
          </label>
          <label class="message-type-option">
            <input type="radio" name="messageType" value="private" ${initialValues.messageType === 'private' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-user-secret"></i>
              <span>Private</span>
            </span>
          </label>
          <label class="message-type-option">
            <input type="radio" name="messageType" value="self" ${initialValues.messageType === 'self' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-user"></i>
              <span>Self</span>
            </span>
          </label>
        </div>
      </div>
    </div>
    </form>
    `;

		const result = await this.showDialog({
			title,
			content,
			dialogClass: 'daggerheart-roll-dialog',
			buttons: {
				roll: {
					label: 'Roll',
					icon: "<i class='fas fa-dice-d12'></i>",
					callback: html => {
						const netValues = {
							d4: parseInt(html.find('input[name="advantage-d4"]').val()) || 0,
							d6: parseInt(html.find('input[name="advantage-d6"]').val()) || 0,
							d8: parseInt(html.find('input[name="advantage-d8"]').val()) || 0,
							d10: parseInt(html.find('input[name="advantage-d10"]').val()) || 0,
						};

						const rawAdvantage = {
							d4: Math.max(0, netValues.d4),
							d6: Math.max(0, netValues.d6),
							d8: Math.max(0, netValues.d8),
							d10: Math.max(0, netValues.d10),
						};

						const rawDisadvantage = {
							d4: Math.max(0, -netValues.d4),
							d6: Math.max(0, -netValues.d6),
							d8: Math.max(0, -netValues.d8),
							d10: Math.max(0, -netValues.d10),
						};

						const netResult = calculateNetResult(rawAdvantage, rawDisadvantage);

						let spend = 0;
						let experice = 0;
						html.find('.exp-checkbox:checked').each((i, el) => {
							const val = parseInt(el.dataset.mod) || 0;
							if (val > 0) {
								experice += val;
								spend += 1;
							}
						});

						let modifier = parseInt(html.find('#dualityDiceModifierInput').val()) || 0;
						if (spend > 0 && actor && actor.type === 'character') {
							if (actor.system.hope.value >= spend) {
								modifier += experice;
								if (game.paused) {
									console.log('Daggerheart | Hope spend skipped - game is paused');
								} else {
									const value = actor.system.hope.value - spend;
									actor.update({ 'system.hope.value': Math.max(value, 0) });
								}
							} else {
								ui.notifications.warn(game.i18n.localize('DH.Notify.NoHopeForExperience'));
							}
						}

						const hopeDieSize = html.find('#hopeDieSize').val();
						const fearDieSize = html.find('#fearDieSize').val();
						const messageType = html.find('input[name="messageType"]:checked').val() || 'public';
						return {
							advantage: netResult.advantage,
							disadvantage: netResult.disadvantage,
							modifier,
							hopeDieSize,
							fearDieSize,
							messageType,
						};
					},
				},
				rollReaction: {
					label: 'Reaction',
					icon: "<i class='fas fa-dice-d12'></i>",
					callback: html => {
						const netValues = {
							d4: parseInt(html.find('input[name="advantage-d4"]').val()) || 0,
							d6: parseInt(html.find('input[name="advantage-d6"]').val()) || 0,
							d8: parseInt(html.find('input[name="advantage-d8"]').val()) || 0,
							d10: parseInt(html.find('input[name="advantage-d10"]').val()) || 0,
						};

						const rawAdvantage = {
							d4: Math.max(0, netValues.d4),
							d6: Math.max(0, netValues.d6),
							d8: Math.max(0, netValues.d8),
							d10: Math.max(0, netValues.d10),
						};

						const rawDisadvantage = {
							d4: Math.max(0, -netValues.d4),
							d6: Math.max(0, -netValues.d6),
							d8: Math.max(0, -netValues.d8),
							d10: Math.max(0, -netValues.d10),
						};

						const netResult = calculateNetResult(rawAdvantage, rawDisadvantage);

						let modifier = parseInt(html.find('#dualityDiceModifierInput').val()) || 0;
						html.find('.exp-checkbox:checked').each((i, el) => {
							modifier += parseInt(el.dataset.mod) || 0;
						});
						const hopeDieSize = html.find('#hopeDieSize').val();
						const fearDieSize = html.find('#fearDieSize').val();
						const messageType = html.find('input[name="messageType"]:checked').val() || 'public';
						return {
							advantage: netResult.advantage,
							disadvantage: netResult.disadvantage,
							modifier,
							hopeDieSize,
							fearDieSize,
							reaction: true,
							messageType,
						};
					},
				},
				cancel: {
					label: 'Cancel',
					callback: () => null,
				},
			},
			default: 'roll',
			render: html => {
				html.find('.dice-btn').on('click', e => {
					const button = $(e.currentTarget);
					const die = button.data('die');
					const isIncrease = button.hasClass('increase');

					const hiddenInput = html.find(`input[name="advantage-${die}"]`);
					const countSpan = button.siblings('.dice-icon').find('.dice-count');

					let currentValue = parseInt(hiddenInput.val()) || 0;

					if (isIncrease) {
						currentValue = Math.min(currentValue + 1, 10);
					} else {
						currentValue = Math.max(currentValue - 1, -10);
					}

					hiddenInput.val(currentValue);
					countSpan.text(currentValue);

					const diceIcon = button.siblings('.dice-icon');
					if (currentValue === 0) {
						diceIcon.addClass('empty').removeClass('advantage disadvantage');
					} else if (currentValue > 0) {
						diceIcon.removeClass('empty disadvantage').addClass('advantage');
					} else {
						diceIcon.removeClass('empty advantage').addClass('disadvantage');
					}
				});

				function incrementInput(selector, by, clampLo = null) {
					let input = html.find(selector);
					if (input.length === 0) return;
					let newValue = (parseInt(input.val()) || 0) + by;
					if (clampLo !== null) newValue = Math.max(clampLo, newValue);
					input.val(newValue);
				}

				html.find('#mod-plus').click(() => incrementInput('#dualityDiceModifierInput', 1));
				html.find('#mod-minus').click(() => incrementInput('#dualityDiceModifierInput', -1));

				for (const input of html.find('input[type=number]')) {
					input.addEventListener('wheel', event => {
						if (input === document.activeElement) {
							event.preventDefault();
							event.stopPropagation();
							const step = Math.sign(-1 * event.deltaY);
							const oldValue = Number(input.value) || 0;
							input.value = String(oldValue + step);
						}
					});
				}

				html.find('.dice-control').each((i, control) => {
					const $control = $(control);
					const hiddenInput = $control.find('input[type="hidden"]');
					const diceIcon = $control.find('.dice-icon');
					const currentValue = parseInt(hiddenInput.val()) || 0;

					if (currentValue === 0) {
						diceIcon.addClass('empty').removeClass('advantage disadvantage');
					} else if (currentValue > 0) {
						diceIcon.removeClass('empty disadvantage').addClass('advantage');
					} else {
						diceIcon.removeClass('empty advantage').addClass('disadvantage');
					}
				});
			},
		});

		return result;
	}

	static async showNPCRollDialog(config = {}) {
		const { title = 'Roll', rollDetails = {} } = config;

		const defaults = {
			dieSize: 'd20',
			advantage: 0,
			disadvantage: 0,
			modifier: 0,
			messageType: 'public',
		};

		const initialValues = { ...defaults, ...rollDetails };

		const content = `
    <form>
    <div class="flex-col" style="align-items: stretch; gap: 2rem">
      <div class="flex-row">
        <div class="flex-col stepper-group">
          <span class="label-bar">Advantage</span>
          <div class="flex-row">
            <button id="adv-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="npcDiceAdvantageInput" min="0" name="advantage" step="1" type="number" value="${initialValues.advantage}"/>
            <button id="adv-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
        <div class="flex-col stepper-group">
          <span class="label-bar">Disadvantage</span>
          <div class="flex-row">
            <button id="dis-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="npcDiceDisadvantageInput" min="0" name="disadvantage" step="1" type="number" value="${initialValues.disadvantage}"/>
            <button id="dis-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
      </div>
      <div class="flex-row">
        <div class="flex-col stepper-group">
          <span class="label-bar">Flat Modifier</span>
          <div class="flex-row">
            <button id="mod-minus" class="clicker-button clicker-minus-button" type="button"></button>
            <input id="npcDiceModifierInput" autofocus name="modifier" step="1" type="number" value="${initialValues.modifier}"/>
            <button id="mod-plus" class="clicker-button clicker-plus-button" type="button"></button>
          </div>
        </div>
      </div>
      <div class="flex-col">
        <span class="label-bar">Message Type</span>
        <div class="message-type-selection">
          <label class="message-type-option">
            <input type="radio" name="messageType" value="public" ${initialValues.messageType === 'public' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-globe"></i>
              <span>Public</span>
            </span>
          </label>
          <label class="message-type-option">
            <input type="radio" name="messageType" value="blind" ${initialValues.messageType === 'blind' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-eye-slash"></i>
              <span>Blind</span>
            </span>
          </label>
          <label class="message-type-option">
            <input type="radio" name="messageType" value="private" ${initialValues.messageType === 'private' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-user-secret"></i>
              <span>Private</span>
            </span>
          </label>
          <label class="message-type-option">
            <input type="radio" name="messageType" value="self" ${initialValues.messageType === 'self' ? 'checked' : ''}>
            <span class="message-type-label">
              <i class="fas fa-user"></i>
              <span>Self</span>
            </span>
          </label>
        </div>
      </div>
    </div>
    </form>
    `;

		const result = await this.showDialog({
			title,
			content,
			dialogClass: 'daggerheart-roll-dialog',
			buttons: {
				roll: {
					label: 'Roll',
					icon: "<i class='fas fa-dice-d20'></i>",
					callback: html => {
						const advantage = parseInt(html.find('#npcDiceAdvantageInput').val()) || 0;
						const disadvantage = parseInt(html.find('#npcDiceDisadvantageInput').val()) || 0;
						const modifier = parseInt(html.find('#npcDiceModifierInput').val()) || 0;
						const dieSize = defaults.dieSize;
						const messageType = html.find('input[name="messageType"]:checked').val() || 'public';
						return { advantage, disadvantage, modifier, dieSize, messageType };
					},
				},
				rollReaction: {
					label: 'Reaction',
					icon: "<i class='fas fa-dice-d20'></i>",
					callback: html => {
						const advantage = parseInt(html.find('#npcDiceAdvantageInput').val()) || 0;
						const disadvantage = parseInt(html.find('#npcDiceDisadvantageInput').val()) || 0;
						const modifier = parseInt(html.find('#npcDiceModifierInput').val()) || 0;
						const dieSize = defaults.dieSize;
						const messageType = html.find('input[name="messageType"]:checked').val() || 'public';
						return { advantage, disadvantage, modifier, dieSize, reaction: true, messageType };
					},
				},
				cancel: {
					label: 'Cancel',
					callback: () => null,
				},
			},
			default: 'roll',
			render: html => {
				function incrementInput(selector, by, clampLo = null) {
					let input = html.find(selector);
					if (input.length === 0) return;
					let newValue = (parseInt(input.val()) || 0) + by;
					if (clampLo !== null) newValue = Math.max(clampLo, newValue);
					input.val(newValue);
				}

				html.find('#adv-plus').click(() => incrementInput('#npcDiceAdvantageInput', 1, 0));
				html.find('#adv-minus').click(() => incrementInput('#npcDiceAdvantageInput', -1, 0));
				html.find('#dis-plus').click(() => incrementInput('#npcDiceDisadvantageInput', 1, 0));
				html.find('#dis-minus').click(() => incrementInput('#npcDiceDisadvantageInput', -1, 0));
				html.find('#mod-plus').click(() => incrementInput('#npcDiceModifierInput', 1));
				html.find('#mod-minus').click(() => incrementInput('#npcDiceModifierInput', -1));

				for (const input of html.find('input[type=number]')) {
					input.addEventListener('wheel', event => {
						if (input === document.activeElement) {
							event.preventDefault();
							event.stopPropagation();
							const step = Math.sign(-1 * event.deltaY);
							const oldValue = Number(input.value) || 0;
							input.value = String(oldValue + step);
						}
					});
				}
			},
		});

		return result;
	}

	static async showRecoveryAllocationDialog(config) {
		const { characterName, availablePoints, currentHP, currentStress, maxHP, maxStress } = config;

		const maxHPHealing = currentHP;
		const maxStressHealing = currentStress;

		const content = `
      <form>
        <div class="recovery-dialog-content">
          <div class="recovery-header">
            <p class="recovery-title">${characterName} can recover <strong>${availablePoints}</strong> points!</p>
            <p class="recovery-subtitle">Allocate healing between HP and Stress</p>
          </div>

          <div class="current-status">
            <div class="status-item">
              <span class="status-label">Current HP:</span>
              <span class="status-value">${currentHP}/${maxHP}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Current Stress:</span>
              <span class="status-value">${currentStress}/${maxStress}</span>
            </div>
          </div>

          <div class="allocation-controls">
            <div class="allocation-group">
              <label for="hpHealing">HP Healing:</label>
              <div class="stepper-group">
                <button type="button" class="recovery-minus" data-target="hpHealing">-</button>
                <input type="number" id="hpHealing" name="hpHealing" min="0" max="${Math.min(maxHPHealing, availablePoints)}" value="0" />
                <button type="button" class="recovery-plus" data-target="hpHealing">+</button>
              </div>
              <span class="max-available">(max: ${maxHPHealing})</span>
            </div>

            <div class="allocation-group">
              <label for="stressHealing">Stress Healing:</label>
              <div class="stepper-group">
                <button type="button" class="recovery-minus" data-target="stressHealing">-</button>
                <input type="number" id="stressHealing" name="stressHealing" min="0" max="${Math.min(maxStressHealing, availablePoints)}" value="0" />
                <button type="button" class="recovery-plus" data-target="stressHealing">+</button>
              </div>
              <span class="max-available">(max: ${maxStressHealing})</span>
            </div>
          </div>

          <div class="allocation-status">
            <p>Points Used: <span id="pointsUsed">0</span> / <span id="pointsAvailable">${availablePoints}</span></p>
            <p id="remainingPoints">Remaining: ${availablePoints}</p>
          </div>

          <div class="quick-buttons">
            <button type="button" class="quick-btn" data-action="maxHP">Max HP</button>
            <button type="button" class="quick-btn" data-action="maxStress">Max Stress</button>
            <button type="button" class="quick-btn" data-action="split">Split Even</button>
            <button type="button" class="quick-btn" data-action="clear">Clear All</button>
          </div>
        </div>
      </form>
    `;

		const result = await this.showDialog({
			title: `Recovery Allocation - ${characterName}`,
			content,
			dialogClass: 'recovery-dialog',
			buttons: {
				confirm: {
					label: 'Apply Healing',
					icon: '<i class="fas fa-heart"></i>',
					callback: html => {
						const hpHealing = parseInt(html.find('#hpHealing').val()) || 0;
						const stressHealing = parseInt(html.find('#stressHealing').val()) || 0;
						return { html, button: 'confirm', hpHealing, stressHealing };
					},
				},
				cancel: {
					label: 'Cancel',
					callback: () => null,
				},
			},
			default: 'confirm',
			render: html => {
				const hpInput = html.find('#hpHealing');
				const stressInput = html.find('#stressHealing');
				const pointsUsedSpan = html.find('#pointsUsed');
				const remainingSpan = html.find('#remainingPoints');

				function updateDisplay() {
					const hpVal = parseInt(hpInput.val()) || 0;
					const stressVal = parseInt(stressInput.val()) || 0;
					const total = hpVal + stressVal;
					const remaining = availablePoints - total;

					pointsUsedSpan.text(total);
					remainingSpan.text(`Remaining: ${remaining}`);

					if (total > availablePoints) {
						remainingSpan.css('color', '#e38c3e').text(`Over by: ${total - availablePoints}`);
					} else if (total === availablePoints) {
						remainingSpan.css('color', '#81ccc3').text('Perfect allocation!');
					} else {
						remainingSpan.css('color', '#f0f0e0').text(`Remaining: ${remaining}`);
					}

					const remainingForHP = Math.min(maxHPHealing, hpVal + remaining);
					const remainingForStress = Math.min(maxStressHealing, stressVal + remaining);

					hpInput.attr('max', remainingForHP);
					stressInput.attr('max', remainingForStress);
				}

				hpInput.on('input change', updateDisplay);
				stressInput.on('input change', updateDisplay);

				html.find('.recovery-plus').on('click', e => {
					const target = $(e.currentTarget).data('target');
					const input = html.find(`#${target}`);
					const currentVal = parseInt(input.val()) || 0;
					const maxVal = parseInt(input.attr('max')) || 0;

					if (currentVal < maxVal) {
						input.val(currentVal + 1);
						updateDisplay();
					}
				});

				html.find('.recovery-minus').on('click', e => {
					const target = $(e.currentTarget).data('target');
					const input = html.find(`#${target}`);
					const currentVal = parseInt(input.val()) || 0;

					if (currentVal > 0) {
						input.val(currentVal - 1);
						updateDisplay();
					}
				});

				html.find('.quick-btn').on('click', e => {
					const action = $(e.currentTarget).data('action');

					switch (action) {
						case 'maxHP':
							hpInput.val(Math.min(maxHPHealing, availablePoints));
							stressInput.val(0);
							break;
						case 'maxStress':
							hpInput.val(0);
							stressInput.val(Math.min(maxStressHealing, availablePoints));
							break;
						case 'split':
							const splitAmount = Math.floor(availablePoints / 2);
							const hpAmount = Math.min(splitAmount, maxHPHealing);
							const stressAmount = Math.min(availablePoints - hpAmount, maxStressHealing);
							hpInput.val(hpAmount);
							stressInput.val(stressAmount);
							break;
						case 'clear':
							hpInput.val(0);
							stressInput.val(0);
							break;
					}

					updateDisplay();
				});

				updateDisplay();
			},
		});

		return result;
	}

	static async showShortRestDialog(characterName, actor) {
		const options = [
			{
				id: 'tend-wounds',
				label: 'Tend to Wounds',
				value: 'tend-wounds',
				description: 'Clear 1d4 + character tier hit points',
			},
			{
				id: 'clear-stress',
				label: 'Clear Stress',
				value: 'clear-stress',
				description: 'Clear 1d4 + character tier stress',
			},
			{
				id: 'repair-armor',
				label: 'Repair Armor',
				value: 'repair-armor',
				description: 'Clear 1d4 + character tier armor slots',
			},
			{
				id: 'prepare',
				label: 'Prepare',
				value: 'prepare',
				description: 'Gain a hope',
			},
		];

		const content = `
      <form>
        <div class="daggerheart-dialog-content">
          <p class="dialog-description">Choose your options for your Short Rest:</p>
          <div class="checkbox-group">
            ${options
							.map(
								option => `
              <div class="checkbox-item">
                <input type="checkbox"
                       id="${option.id}"
                       name="${option.id}"
                       value="${option.value}">
                <label for="${option.id}">
                  <strong>${option.label}</strong>
                  <span class="option-description">${option.description}</span>
                </label>
              </div>
            `
							)
							.join('')}
          </div>
        </div>
      </form>
    `;

		const result = await this.showDialog({
			title: `Short Rest - ${characterName}`,
			content,
			dialogClass: 'checkbox-dialog short-rest-dialog',
			buttons: {
				confirm: {
					label: 'Take Short Rest',
					icon: '<i class="fas fa-bed"></i>',
					callback: html => {
						const selected = [];
						html.find('input[type="checkbox"]:checked').each((i, el) => {
							selected.push(el.value);
						});
						return { html, button: 'confirm', selected };
					},
				},
				cancel: {
					label: 'Cancel',
					callback: () => null,
				},
			},
			render: html => {},
		});

		if (result && result.selected) {
			await this._processShortRest(characterName, actor, result.selected);
			return result.selected;
		}

		return null;
	}

	static async _processShortRest(characterName, actor, selectedOptions) {
		const tier = game.daggerheart?.getTierOfPlay ? game.daggerheart.getTierOfPlay(actor) : 1;

		try {
			await ChatMessage.create({
				content: `
          <div class="short-rest-start">
            <p><strong>${characterName} takes a Short Rest</strong></p>
            <p><em>Taking time to recover and regroup...</em></p>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'short-rest-start',
						characterName: characterName,
					},
				},
			});
		} catch (error) {
			console.error('Error creating short rest start chat message:', error);
			ui.notifications.warn('Chat message failed to send, but rest continues.');
		}

		for (const option of selectedOptions) {
			try {
				switch (option) {
					case 'tend-wounds':
						await this._processTendWounds(characterName, actor, tier);
						break;
					case 'clear-stress':
						await this._processClearStress(characterName, actor, tier);
						break;
					case 'repair-armor':
						await this._processRepairArmor(characterName, actor, tier);
						break;
					case 'prepare':
						await this._processPrepare(characterName, actor);
						break;
				}

				await new Promise(resolve => setTimeout(resolve, 100));
			} catch (error) {
				console.error(`Error processing short rest option '${option}':`, error);
				ui.notifications.warn(`Failed to process ${option} during short rest.`);
			}
		}
	}

	static async _processTendWounds(characterName, actor, tier) {
		const roll = new Roll(`1d4 + ${tier}`);
		await roll.evaluate();

		const healingAmount = roll.total;
		const currentHP = actor.system.health?.value || 0;
		const newHP = Math.max(0, currentHP - healingAmount);

		await actor.update({ 'system.health.value': newHP });

		try {
			await ChatMessage.create({
				content: `
          <div class="short-rest-tend-wounds">
            <p><strong>Tend to Wounds</strong></p>
            <p>${characterName} tends to their wounds, healing <strong>${healingAmount}</strong> hit points.</p>
            <p><em>HP: ${currentHP} → ${newHP}</em></p>
            <div class="dice-roll">
              <div class="dice-result">
                <div class="dice-formula">${roll.formula}</div>
                <div class="dice-total">${roll.total}</div>
              </div>
            </div>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'short-rest-tend-wounds',
						characterName: characterName,
						healingAmount: healingAmount,
					},
				},
			});
		} catch (error) {
			console.error('Error creating short rest tend wounds chat message:', error);
			ui.notifications.warn('Chat message failed to send, but healing was applied.');
		}
	}

	static async _processClearStress(characterName, actor, tier) {
		const roll = new Roll(`1d4 + ${tier}`);
		await roll.evaluate();

		const stressCleared = roll.total;
		const currentStress = actor.system.stress?.value || 0;
		const newStress = Math.max(0, currentStress - stressCleared);

		await actor.update({ 'system.stress.value': newStress });

		try {
			await ChatMessage.create({
				content: `
          <div class="short-rest-clear-stress">
            <p><strong>Clear Stress</strong></p>
            <p>${characterName} takes time to decompress, clearing <strong>${stressCleared}</strong> stress.</p>
            <p><em>Stress: ${currentStress} → ${newStress}</em></p>
            <div class="dice-roll">
              <div class="dice-result">
                <div class="dice-formula">${roll.formula}</div>
                <div class="dice-total">${roll.total}</div>
              </div>
            </div>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'short-rest-clear-stress',
						characterName: characterName,
						stressCleared: stressCleared,
					},
				},
			});
		} catch (error) {
			console.error('Error creating short rest clear stress chat message:', error);
			ui.notifications.warn('Chat message failed to send, but stress was cleared.');
		}
	}

	static async _processRepairArmor(characterName, actor, tier) {
		const roll = new Roll(`1d4 + ${tier}`);
		await roll.evaluate();

		const armorRepaired = roll.total;
		const currentArmorSlots = actor.system.defenses?.['armor-slots']?.value || 0;
		const maxArmor = actor.system.defenses?.armor?.value || 0;
		const newArmorSlots = Math.max(0, currentArmorSlots - armorRepaired);

		await actor.update({ 'system.defenses.armor-slots.value': newArmorSlots });

		try {
			await ChatMessage.create({
				content: `
          <div class="short-rest-repair-armor">
            <p><strong>Repair Armor</strong></p>
            <p>${characterName} mends their armor, clearing <strong>${armorRepaired}</strong> armor slots.</p>
            <p><em>Damaged Armor: ${currentArmorSlots} → ${newArmorSlots}</em></p>
            <div class="dice-roll">
              <div class="dice-result">
                <div class="dice-formula">${roll.formula}</div>
                <div class="dice-total">${roll.total}</div>
              </div>
            </div>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'short-rest-repair-armor',
						characterName: characterName,
						armorRepaired: armorRepaired,
					},
				},
			});
		} catch (error) {
			console.error('Error creating short rest repair armor chat message:', error);
			ui.notifications.warn('Chat message failed to send, but armor was repaired.');
		}
	}

	static async _processPrepare(characterName, actor) {
		const currentHope = actor.system.hope?.value || 0;
		const maxHope = actor.system.hope?.max || 0;
		const newHope = Math.min(maxHope, currentHope + 1);

		await actor.update({ 'system.hope.value': newHope });

		try {
			await ChatMessage.create({
				content: `
          <div class="short-rest-prepare">
            <p><strong>Prepare</strong></p>
            <p>${characterName} takes time to prepare, gaining <strong>1 Hope</strong>.</p>
            <p><em>Hope: ${currentHope} → ${newHope}</em></p>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'short-rest-prepare',
						characterName: characterName,
						hopeGained: 1,
					},
				},
			});
		} catch (error) {
			console.error('Error creating short rest prepare chat message:', error);
			ui.notifications.warn('Chat message failed to send, but Hope was gained.');
		}
	}

	static async showLongRestDialog(characterName, actor) {
		const options = [
			{
				id: 'tend-all-wounds',
				label: 'Tend to All Wounds',
				value: 'tend-all-wounds',
				description: 'Clear all Hit Points (can do to an ally instead)',
			},
			{
				id: 'clear-all-stress',
				label: 'Clear All Stress',
				value: 'clear-all-stress',
				description: 'Clear all Stress',
			},
			{
				id: 'repair-all-armor',
				label: 'Repair All Armor',
				value: 'repair-all-armor',
				description: 'Clear all Armor Slots (can do to an ally instead)',
			},
			{
				id: 'prepare',
				label: 'Prepare',
				value: 'prepare',
				description: 'Gain 1 Hope (2 Hope if done with party members)',
			},
			{
				id: 'work-project',
				label: 'Work on a Project',
				value: 'work-project',
				description: 'Establish or continue work on a project',
			},
		];

		const content = `
      <form>
        <div class="daggerheart-dialog-content">
          <div class="dialog-reminder">
            <p><strong>Domain Card Swapping:</strong> You can swap any domain cards in your loadout for cards in your vault.</p>
          </div>
          <p class="dialog-description">Choose your options for your Long Rest:</p>
          <div class="checkbox-group">
            ${options
							.map(
								option => `
              <div class="checkbox-item" data-option-id="${option.id}">
                <input type="checkbox"
                       id="${option.id}"
                       name="${option.id}"
                       value="${option.value}">
                <label for="${option.id}">
                  <strong>${option.label}</strong>
                  <span class="option-description">${option.description}</span>
                </label>
              </div>
            `
							)
							.join('')}
          </div>
        </div>
      </form>
    `;

		const result = await this.showDialog({
			title: `Long Rest - ${characterName}`,
			content,
			dialogClass: 'checkbox-dialog long-rest-dialog',
			buttons: {
				confirm: {
					label: 'Take Long Rest',
					icon: '<i class="fas fa-campground"></i>',
					callback: html => {
						const selected = [];
						html.find('input[type="checkbox"]:checked').each((i, el) => {
							selected.push(el.value);
						});
						return { html, button: 'confirm', selected };
					},
				},
				cancel: {
					label: 'Cancel',
					callback: () => null,
				},
			},
			render: html => {},
		});

		if (result && result.selected) {
			await this._processLongRest(characterName, actor, result.selected);
			return result.selected;
		}

		return null;
	}

	static async _processLongRest(characterName, actor, selectedOptions) {
		try {
			await ChatMessage.create({
				content: `
          <div class="long-rest-start">
            <p><strong>${characterName} takes a Long Rest</strong></p>
            <p><em>Making camp and taking time to truly recover...</em></p>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'long-rest-start',
						characterName: characterName,
					},
				},
			});
		} catch (error) {
			console.error('Error creating long rest start chat message:', error);
			ui.notifications.warn('Chat message failed to send, but rest continues.');
		}

		const optionCounts = {};
		selectedOptions.forEach(option => {
			optionCounts[option] = (optionCounts[option] || 0) + 1;
		});

		for (const [option, count] of Object.entries(optionCounts)) {
			for (let i = 0; i < count; i++) {
				try {
					switch (option) {
						case 'tend-all-wounds':
							await this._processLongRestTendWounds(characterName, actor);
							break;
						case 'clear-all-stress':
							await this._processLongRestClearStress(characterName, actor);
							break;
						case 'repair-all-armor':
							await this._processLongRestRepairArmor(characterName, actor);
							break;
						case 'prepare':
							await this._processLongRestPrepare(characterName, actor);
							break;
						case 'work-project':
							await this._processLongRestWorkProject(characterName, actor);
							break;
					}

					await new Promise(resolve => setTimeout(resolve, 100));
				} catch (error) {
					console.error(`Error processing long rest option '${option}':`, error);
					ui.notifications.warn(`Failed to process ${option} during long rest.`);
				}
			}
		}
	}

	static async _processLongRestTendWounds(characterName, actor) {
		const currentHP = actor.system.health?.value || 0;
		const newHP = 0;

		await actor.update({ 'system.health.value': newHP });

		try {
			await ChatMessage.create({
				content: `
          <div class="long-rest-tend-wounds">
            <p><strong>Tend to All Wounds</strong></p>
            <p>${characterName} takes time to properly tend to all their wounds, fully healing their injuries.</p>
            <p><em>HP: ${currentHP} → ${newHP} (Fully Healed!)</em></p>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'long-rest-tend-wounds',
						characterName: characterName,
						healingAmount: currentHP,
					},
				},
			});
		} catch (error) {
			console.error('Error creating long rest tend wounds chat message:', error);
			ui.notifications.warn('Chat message failed to send, but healing was applied.');
		}
	}

	static async _processLongRestClearStress(characterName, actor) {
		const currentStress = actor.system.stress?.value || 0;
		const newStress = 0;

		await actor.update({ 'system.stress.value': newStress });

		try {
			await ChatMessage.create({
				content: `
          <div class="long-rest-clear-stress">
            <p><strong>Clear All Stress</strong></p>
            <p>${characterName} takes time to decompress and center themselves, clearing away all mental fatigue.</p>
            <p><em>Stress: ${currentStress} → ${newStress} (Completely Relaxed!)</em></p>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'long-rest-clear-stress',
						characterName: characterName,
						stressCleared: currentStress,
					},
				},
			});
		} catch (error) {
			console.error('Error creating long rest clear stress chat message:', error);
			ui.notifications.warn('Chat message failed to send, but stress was cleared.');
		}
	}

	static async _processLongRestRepairArmor(characterName, actor) {
		const currentArmorSlots = actor.system.defenses?.['armor-slots']?.value || 0;
		const newArmorSlots = 0;

		await actor.update({ 'system.defenses.armor-slots.value': newArmorSlots });

		try {
			await ChatMessage.create({
				content: `
          <div class="long-rest-repair-armor">
            <p><strong>Repair All Armor</strong></p>
            <p>${characterName} spends time meticulously repairing and maintaining their armor, restoring it to perfect condition.</p>
            <p><em>Damaged Armor: ${currentArmorSlots} → ${newArmorSlots} (Fully Repaired!)</em></p>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'long-rest-repair-armor',
						characterName: characterName,
						armorRepaired: currentArmorSlots,
					},
				},
			});
		} catch (error) {
			console.error('Error creating long rest repair armor chat message:', error);
			ui.notifications.warn('Chat message failed to send, but armor was repaired.');
		}
	}

	static async _processLongRestPrepare(characterName, actor) {
		const currentHope = actor.system.hope?.value || 0;
		const maxHope = actor.system.hope?.max || 0;
		const hopeGained = 1;
		const newHope = Math.min(maxHope, currentHope + hopeGained);

		await actor.update({ 'system.hope.value': newHope });

		try {
			await ChatMessage.create({
				content: `
          <div class="long-rest-prepare">
            <p><strong>Prepare</strong></p>
            <p>${characterName} takes time to prepare for the challenges ahead, steeling their resolve.</p>
            <p><em>Hope: ${currentHope} → ${newHope} (+${hopeGained} Hope)</em></p>
            <div class="prepare-note">
              <p><em>Note: If coordinating with party members, each participant gains 2 Hope instead.</em></p>
            </div>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'long-rest-prepare',
						characterName: characterName,
						hopeGained: hopeGained,
					},
				},
			});
		} catch (error) {
			console.error('Error creating long rest prepare chat message:', error);
			ui.notifications.warn('Chat message failed to send, but Hope was gained.');
		}
	}

	static async _processLongRestWorkProject(characterName, actor) {
		try {
			await ChatMessage.create({
				content: `
          <div class="long-rest-work-project">
            <p><strong>Work on a Project</strong></p>
            <p>${characterName} dedicates time to working on a personal or group project.</p>
            <div class="project-note">
              <p><em>Describe what ${characterName} works on during this time - perhaps crafting, research, writing, or contributing to a group endeavor.</em></p>
              <p><em>This is an opportunity for character development and storytelling!</em></p>
            </div>
          </div>
        `,
				speaker: ChatMessage.getSpeaker({ actor }),
				type: CONST.CHAT_MESSAGE_TYPES.OTHER,
				flags: {
					'uo-msg': {
						restType: 'long-rest-work-project',
						characterName: characterName,
					},
				},
			});
		} catch (error) {
			console.error('Error creating long rest work project chat message:', error);
			ui.notifications.warn('Chat message failed to send, but work continues.');
		}
	}
}
