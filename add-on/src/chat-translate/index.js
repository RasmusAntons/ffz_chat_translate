SUPPORTED_LANGS = {
	'en': 'English',
	'sq': 'Albanian',
	'ar': 'Arabic',
	'az': 'Azerbaijani',
	'bn': 'Bengali',
	'bg': 'Bulgarian',
	'ca': 'Catalan',
	'zh': 'Chinese',
	'zt': 'Chinese (traditional)',
	'cs': 'Czech',
	'da': 'Danish',
	'nl': 'Dutch',
	'eo': 'Esperanto',
	'et': 'Estonian',
	'fi': 'Finnish',
	'fr': 'French',
	'de': 'German',
	'el': 'Greek',
	'he': 'Hebrew',
	'hi': 'Hindi',
	'hu': 'Hungarian',
	'id': 'Indonesian',
	'ga': 'Irish',
	'it': 'Italian',
	'ja': 'Japanese',
	'ko': 'Korean',
	'lv': 'Latvian',
	'lt': 'Lithuanian',
	'ms': 'Malay',
	'nb': 'Norwegian',
	'fa': 'Persian',
	'pl': 'Polish',
	'pt': 'Portuguese',
	'ro': 'Romanian',
	'ru': 'Russian',
	'sk': 'Slovak',
	'sl': 'Slovenian',
	'es': 'Spanish',
	'sv': 'Swedish',
	'tl': 'Tagalog',
	'th': 'Thai',
	'tr': 'Turkish',
	'uk': 'Ukrainian',
	'ur': 'Urdu'
}
STATUS = {
	disabled: {label: 'disabled', color: 'gray'},
	active: {label: 'active', color: ''},
	error: {label: 'error', color: 'red'}
}


class ChatTranslate extends Addon {
	constructor(...args) {
		super(...args);
		this.inject('metadata');
		this.inject('chat');
		this.inject('chat.actions');
		this.load_requires = ['metadata'];
		this.supportedLangs = {...SUPPORTED_LANGS};
		this.status = STATUS.disabled;

		this.settings.add('chat_translate.enabled', {
			default: true,
			ui: {
				path: 'Chat > Translate >> Enable',
				title: 'Enable translation',
				component: 'setting-check-box',
			}
		});
		this.settings.getChanges('chat_translate.enabled', enabled => {
			this.status = enabled ? STATUS.active : STATUS.disabled;
		});

		const languageChoices = Object.entries(this.supportedLangs).map(e => ({
			value: e[0],
			title: e[1]
		})).sort((a, b) => a.title.localeCompare(b.title))

		this.settings.add('chat_translate.preferred_language', {
			default: 'en-US',
			ui: {
				path: 'Chat > Translate >> Languages',
				sort: 1,
				title: 'Preferred Language',
				description: 'Messages will be translated to this language.',
				component: 'setting-select-box',
				data: languageChoices
			}
		});

		// todo: add multiselect
		this.settings.add('chat_translate.second_language', {
			default: 'en-US',
			ui: {
				path: 'Chat > Translate >> Languages',
				sort: 2,
				title: 'Second Language',
				description: 'Messages in this language will not be translated (WIP, this should be a multiselect).',
				component: 'setting-select-box',
				data: languageChoices
			}
		});

		this.settings.add('chat_translate.api_url', {
			default: 'http://localhost:5000',
			ui: {
				path: 'Chat > Translate >> API',
				sort: 100,
				title: 'Translation API URL',
				component: 'setting-text-box'
			}
		});

		const addon = this;

		this.updateMessage = {
			type: 'chat-translate',
			priority: -110,  // TODO: what priority makes sense here? This needs to run after all custom emotes are detected.
			process(tokens, msg) {
				if (!msg.translationStatus)
					addon.startTranslation(tokens, msg);
				if (msg.translatedTokens) {
					let i = 0;
					for (let token of tokens) {
						if (token.type === 'text') {
							token.text = msg.translatedTokens[i++]||'';
						}
					}
				}
				return tokens;
			}
		}
	}

	startTranslation(tokens, msg) {
		if (!this.settings.get('chat_translate.enabled'))
			return;
		msg.translationStatus = {info: 'translation started'};
		const hasText = tokens.find(t => t.type === 'text' && t.text.match(/\S/)) !== undefined;
		if (!hasText) {
			msg.translationStatus = {info: 'not translated because it contains no text'};
			return;
		}
		const queryText = tokens.map(t => (t.type === 'text') ? t.text : `<p class="${t.type}"></p>`).join(' ');

		const detectEndpoint = new URL(`${this.settings.get('chat_translate.api_url')}/detect`);
		const detectQuery = JSON.stringify({q: queryText});

		this.log.info(`fetching ${detectEndpoint}`)

		fetch(detectEndpoint, {headers: {'Content-Type': 'application/json'}, method: 'POST', body: detectQuery})
				.then(res => res.json()).then(probabilities => {
			this.status = STATUS.active;
			const detectedLanguage = probabilities[0].language;
			const knownLanguages = new Set([this.settings.get('chat_translate.preferred_language'), this.settings.get('chat_translate.second_language')]);
			if (knownLanguages.has(detectedLanguage)) {
				msg.translationStatus.info = `not translated because it is probably ${SUPPORTED_LANGS[detectedLanguage]}`;
				return;
			}
			const translateEndpoint = new URL(`${this.settings.get('chat_translate.api_url')}/translate`);
			const translateQuery = JSON.stringify({
				q: queryText,
				source: detectedLanguage,
				target: this.settings.get('chat_translate.preferred_language'),
				format: 'html'
			});
			fetch(translateEndpoint, {headers: {'Content-Type': 'application/json'}, method: 'POST', body: translateQuery})
					.then(res => res.json()).then(result => {
				if (result.error) {
					msg.translationStatus.info = `translation failed (${result.error})`;
					this.log.error(`failed to translate ${queryText}: ${result.error}`);
					return;
				}
				this.log.info(`translated ${queryText} to ${result.translatedText}`)
				msg.translationStatus.info = `translated from ${SUPPORTED_LANGS[detectedLanguage]}, original message: ${msg.message}`
				this.log.info('translatedText', result.translatedText)
				msg.translatedTokens = result.translatedText.split(/<p class="[a-z]+"><\/p>/g);
				msg.ffz_tokens = null;
				this.emit('chat:update-line', msg.id);
			});
		}).catch(e => {
			this.status = STATUS.error;
		});
	}

	onEnable() {
		this.metadata.define('chat-translation-status', {
			order: 0,
			icon: "ffz-i-language",
			color: data => this.status.color,
			tooltip: data => `Chat translation ${this.status.label}`,
			label: data => 'T'
		});
		this.chat.addTokenizer(this.updateMessage);

		this.actions.addAction('chat-translation-info', {
			presets: [{
				appearance: {
					type: 'text',
					text: 'T'
				}
			}],
			required_context: ['message'],
			title: 'Chat Translation',
			tooltip(data) {
				// TODO: find a better way to access the original message object or store the translation info somewhere else?
				const allMessages = [];
				this.emit('chat:get-messages', true, false, false, allMessages);
				const originalMessage = allMessages.find(o => data.message.id === o.message.id)?.message;
				return originalMessage?.translationStatus?.info;
			}
		});

	}

	onDisable() {
		this.metadata.define('chat-translation-status', null);
		this.metadata.define('chat-translation-info', null);
		this.chat.removeTokenizer(this.updateMessage);
		this.off('chat:receive-message', this.processMessage);
	}

	async onUnload() {
	}
}

ChatTranslate.register();
