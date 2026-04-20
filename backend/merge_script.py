import re
import os

with open('main.py', 'r', encoding='utf-8') as f:
    main_code = f.read()

with open('backend.py', 'r', encoding='utf-8') as f:
    backend_code = f.read()

ocr_models = re.search(r'(class BillScanResult.*?raw_text.*?\n)', main_code, re.DOTALL).group(1)
ocr_helpers = re.search(r'(# ─── OCR helpers ─+.*?)# ─── endpoints ─+', main_code, re.DOTALL).group(1)
ocr_endpoint = re.search(r'(@app\.post\("/api/scan-bill".*?return BillScanResult[^)]+\))', main_code, re.DOTALL).group(1)

# Add imports to backend.py
backend_code = backend_code.replace('import json\nimport os', 'import io\nimport json\nimport os\nimport re')
backend_code = backend_code.replace('from fastapi import FastAPI, HTTPException, Query', 'from fastapi import FastAPI, HTTPException, Query, File, UploadFile')

# Insert models
backend_code = backend_code.replace('class TxResponse(BaseModel):', ocr_models + '\nclass TxResponse(BaseModel):')

# Insert helpers
backend_code = backend_code.replace('# ─────────────────────────────────────────────────────────────────────────────\n# PYDANTIC MODELS', ocr_helpers + '\n# ─────────────────────────────────────────────────────────────────────────────\n# PYDANTIC MODELS')

# Insert endpoint
backend_code += '\n\n' + ocr_endpoint + '\n'

with open('backend_merged.py', 'w', encoding='utf-8') as f:
    f.write(backend_code)
print("Merged successfully.")
