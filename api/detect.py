import sys
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TextClassificationPipeline


class LanguageDetector:
    def __init__(self):
        self.model_name = 'qanastek/51-languages-classifier'
        self.device = 'cuda'
        if not torch.cuda.is_available():
            self.device = 'cpu'
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name, torch_dtype=torch.bfloat16, device_map=self.device)
        self.classifier = TextClassificationPipeline(model=self.model, tokenizer=self.tokenizer)

    def _detect(self, text, top_k=-1):
        res = self.classifier(text, top_k=top_k)
        return res

    def detect_probs(self, text, top_k=-1):
        predictions = self._detect(text, top_k=top_k)
        result = tuple(map(lambda e: (e['label'], e['score']), predictions))
        return result

    def detect(self, text):
        predictions = self._detect(text)
        return predictions[0]['label']


if __name__ == "__main__":
    language_detector = LanguageDetector()
    if len(sys.argv) > 1:
        text = ' '.join(sys.argv[1])
    else:
        text = sys.stdin.read()
    print(language_detector.detect(text))
