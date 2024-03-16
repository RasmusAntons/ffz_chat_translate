SUPPORTED_LANGS = {
	'ar-SA': 'Arabic',
	'de-DE': 'German',
	'en-US': 'English',
	'es-ES': 'Spanish',
	'fi-FI': 'Finnish',
	'fr-FR': 'French',
	'hi-IN': 'Hindi',
	'it-IT': 'Italian',
	'ja-JP': 'Japanese',
	'ko-KR': 'Korean',
	'lv-LV': 'Latvian',
	'my-MM': 'Burmese',
	'nl-NL': 'Dutch',
	'ro-RO': 'Romanian',
	'ru-RU': 'Russian',
	'tr-TR': 'Turkish',
	'vi-VN': 'Vietnamese',
	'zh-CN': 'Chinese',
	'af-ZA': 'Afrikaans',
	'az-AZ': 'Azerbaijani',
	'bn-BD': 'Bengali',
	'fa-IR': 'Farsi',
	'he-IL': 'Hebrew',
	'id-ID': 'Indonesian',
	'ka-GE': 'Georgian',
	'km-KH': 'Khmer',
	'ml-IN': 'Malayalam',
	'mn-MN': 'Mongolian',
	'pl-PL': 'Polish',
	'pt-PT': 'Portuguese',
	'sv-SE': 'Swedish',
	'sw-KE': 'Swahili',
	'ta-IN': 'Tamil',
	'te-IN': 'Telugu',
	'th-TH': 'Thai',
	'tl-PH': 'Tagalog',
	'uk_UA': 'Ukrainian',
	'ur-PK': 'Urdu',
	'sl-SL': 'Slovenian'
}
STATUS = {
	disabled: {label: 'disabled', color: 'gray'},
	active: {label: 'active', color: ''},
	error: {label: 'error', color: 'red'}
}
KNOWN_LANGUAGE_THRESHOLD = 0.1;


class ChatTranslate extends Addon {
	constructor(...args) {
		super(...args);
		this.inject('metadata');
		this.inject('chat');
		this.inject('chat.actions');
		this.inject('site.fine');
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
			default: 'http://localhost:8000',
			ui: {
				path: 'Chat > Translate >> API',
				sort: 100,
				title: 'Translation API URL',
				component: 'setting-text-box'
			}
		});

		this.updateMessage = {
			type: 'chat-translate',
			priority: 10,
			process(tokens, msg) {
				if (msg.translation) {
					return [{type: 'text', text: msg.translation}];
				}
				return tokens;
			}
		}
	}

	async onLoad() {
		this.chatLines = this.fine._wrappers.get('chat-line');
	}

	forceUpdateMessage(message) {
		message.ffz_tokens = null;
		message.ffz_reply = null;
		message.highlights = message.mentioned = message.mention_color = message.color_priority = null;
		let messageInstance = null;
		for (const inst of this.chatLines.instances) {
			if (inst.props.message.id === message.id) {
				inst.forceUpdate();
				break;
			}
		}

	}

	processMessage(event) {
		this.log.info(event);
		if (!this.settings.get('chat_translate.enabled'))
			return tokens;
		// todo: filter out emotes
		const originalContent = event.message.message
		const detectEndpoint = new URL(`${this.settings.get('chat_translate.api_url')}/detect_probs`);
		detectEndpoint.search = new URLSearchParams({text: originalContent, top: 50}).toString();

		fetch(detectEndpoint).then(res => res.json()).then(probabilities => {
			this.status = STATUS.active;
			for (let language of new Set([this.settings.get('chat_translate.preferred_language'), this.settings.get('chat_translate.second_language')])) {
				const probability = probabilities.language.find(e => e[0] === language);
				if (probability && probability[1] >= KNOWN_LANGUAGE_THRESHOLD) {
					this.log.info(`not translating message because it is probably ${language}: ${originalContent}`);
					return;
				}
			}
			const detectedLanguage = probabilities.language[0][0];
			const translateEndpoint = new URL(`${this.settings.get('chat_translate.api_url')}/translate`);
			translateEndpoint.search = new URLSearchParams({
				text: originalContent,
				src_lang: detectedLanguage,
				dst_lang: this.settings.get('chat_translate.preferred_language')
			}).toString();
			fetch(translateEndpoint).then(res => res.json()).then(result => {
				if (result.detail) {
					this.log.info(`failed to translate ${originalContent}: ${result.detail}`);
					return
				}
				this.log.info(`translated ${originalContent} to ${result.translation}`)
				event.message.translation = result.translation;
				this.forceUpdateMessage(event.message);
			});
		}).catch(e => {
			this.status = STATUS.error;
		});
	}

	onEnable() {
		this.metadata.define('chat-translation-status', {
			order: 0,
			icon: 'ffz-i-language',
			color: data => this.status.color,
			tooltip: data => `Chat translation ${this.status.label}`,
			label: data => 'T'
		});
		this.chat.addTokenizer(this.updateMessage);
		this.on('chat:receive-message', this.processMessage);


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
				return data.message.text;
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
