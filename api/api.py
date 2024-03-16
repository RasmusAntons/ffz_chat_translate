from fastapi import FastAPI, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from translate import Translator

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
translator = Translator(with_detector=True)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request, exc):
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=jsonable_encoder({'detail': str(exc)}))


@app.get('/detect')
async def detect_language(text: str):
    language = translator.detector.detect(text)
    return {'language': language}


@app.get('/detect_probs')
async def detect_language(text: str, top: int = None):
    language = translator.detector.detect_probs(text, top_k=top)
    return {'language': language}


@app.get('/translate')
async def translate(text: str, src_lang: str = None, dst_lang: str = None):
    translation, language = translator.translate_and_detect(text, src_lang=src_lang, dst_lang=dst_lang)
    return {'translation': translation, 'language': language}
