import pymupdf
import os

pdf_dir = "web/public"

# List all PDF files
for filename in os.listdir(pdf_dir):
    if filename.endswith('.pdf'):
        filepath = os.path.join(pdf_dir, filename)
        print(f"\n{'='*60}")
        print(f"FILE: {filename}")
        print(f"{'='*60}")
        
        try:
            doc = pymupdf.open(filepath)
            for i, page in enumerate(doc):
                print(f"\n--- Page {i+1} ---")
                print(page.get_text())
            doc.close()
        except Exception as e:
            print(f"Error: {e}")
