# Chat Translation Addon for FrankerFacesZ

An addon for [FrankerFacesZ](https://github.com/FrankerFaceZ/Add-Ons) that translates Twitch chat in real time, using local LLMs.

Specifically, it uses [qanastek/51-languages-classifier](https://huggingface.co/qanastek/51-languages-classifier) to detect the language a message is in and [facebook/mbart-large-50-many-to-many-mmt](https://huggingface.co/facebook/mbart-large-50-many-to-many-mmt) to translate messages.

This is still work in progress and primarily an experiment, I don't know yet if I will continue to work on this.

## TODOs

* Improve translations: Sometimes the model returns unreasonably long results
* Allow setting multiple known languages (currently only 1)
* Add ROCm support: This should be free using transformers, I just cannot test it currently
* Generally improve the UI


## Setup

To use the plugin, the API needs to be running.
Create a new environment, install the dependencies and start the app. The models will automatically be downloaded.
```sh
pip install -r requirements.txt
uvicorn api:app
```
The Addon can be hosted locally as described [here](https://github.com/FrankerFaceZ/Add-Ons?tab=readme-ov-file#getting-started).

## Settings

The addon adds a new settings tab 'Translate' in the 'Chat' section:

**Translation API URL**: This can be used to point to a custom API url, by default uvicorn uses port 8000. \
**Preferred Language**: Messages will be translated to this language. \
**Second language**: Messages in this language will not be translated (WIP, this should be a multiselect).

Also, a message hover action can be configured to show the original message content.
To do that, click on 'Chat' > 'Actions' > 'Message Hover' > '+ New...' and select 'Chat Translation'
