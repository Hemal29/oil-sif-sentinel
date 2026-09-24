import os, zipfile
from google.colab import drive
drive.mount('/content/drive', force_remount=True)
!rm -rf /content/app /content/OIL*
ZIP_PATH = "/content/drive/MyDrive/OIL Problem Light Weight ZIP (wihtout Base Model) FINAL.zip"
# fallback if name mismatched:
if not os.path.exists(ZIP_PATH):
  import glob
  cands = glob.glob("/content/drive/MyDrive/*.zip")
  print(cands)
  ZIP_PATH = cands[0]
print(f"Extracting {ZIP_PATH}...")
with zipfile.ZipFile(ZIP_PATH,'r') as z:
  z.extractall("/content/")
print("Done")