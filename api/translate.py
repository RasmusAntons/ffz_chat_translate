import sys

import torch
from transformers import MBart50TokenizerFast, MBartForConditionalGeneration

from detect import LanguageDetector

SUPPORTED_LANGS = {'ar_AR', 'cs_CZ', 'de_DE', 'en_XX', 'es_XX', 'et_EE', 'fi_FI', 'fr_XX', 'gu_IN', 'hi_IN', 'it_IT',
                   'ja_XX', 'kk_KZ', 'ko_KR', 'lt_LT', 'lv_LV', 'my_MM', 'ne_NP', 'nl_XX', 'ro_RO', 'ru_RU', 'si_LK',
                   'tr_TR', 'vi_VN', 'zh_CN', 'af_ZA', 'az_AZ', 'bn_IN', 'fa_IR', 'he_IL', 'hr_HR', 'id_ID', 'ka_GE',
                   'km_KH', 'mk_MK', 'ml_IN', 'mn_MN', 'mr_IN', 'pl_PL', 'ps_AF', 'pt_XX', 'sv_SE', 'sw_KE', 'ta_IN',
                   'te_IN', 'th_TH', 'tl_XX', 'uk_UA', 'ur_PK', 'xh_ZA', 'gl_ES', 'sl_SI'}


class Translator:
    def __init__(self, with_detector=False):
        self.model_name = 'facebook/mbart-large-50-many-to-many-mmt'
        self.device = 'cuda'
        if not torch.cuda.is_available():
            self.device = 'cpu'
            print("CUDA not available for translation", file=sys.stderr)
        self.model = MBartForConditionalGeneration.from_pretrained(self.model_name, torch_dtype=torch.bfloat16,
                                                                   device_map=self.device)
        self.tokenizer = MBart50TokenizerFast.from_pretrained(self.model_name)
        if with_detector:
            self.detector = LanguageDetector()
        else:
            self.detector = None

    def _lang_code(self, lang_code):
        try:
            return next(filter(lambda lc: lang_code[:2] == lc[:2], SUPPORTED_LANGS))
        except StopIteration:
            raise RuntimeError(f'unsupported language code: {lang_code}')

    def translate_and_detect(self, text, src_lang=None, dst_lang=None):
        if src_lang is None:
            if self.detector is None:
                raise RuntimeError('src_lang cannot be None unless Translator is initialized with with_detector=True')
            src_lang = self.detector.detect(text)
        src_lang = self._lang_code(src_lang)
        dst_lang = self._lang_code(dst_lang or 'en_XX')
        self.tokenizer.src_lang = src_lang
        encoded_input = self.tokenizer(text, return_tensors="pt").to(self.device)
        generated_tokens = self.model.generate(**encoded_input,
                                               forced_bos_token_id=self.tokenizer.lang_code_to_id[dst_lang])
        translated_text = self.tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
        return translated_text[0], src_lang

    def translate(self, text, src_lang=None, dst_lang=None):
        translation, src_lang = self.translate_and_detect(text, src_lang=src_lang, dst_lang=dst_lang)
        return translation


if __name__ == '__main__':
    translator = Translator(with_detector=True)
    if len(sys.argv) > 1:
        text = ' '.join(sys.argv[1])
    else:
        text = sys.stdin.read()
    print(translator.translate(text))
