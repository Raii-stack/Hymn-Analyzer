import urllib.request, json, ssl, zipfile, io, os

print("Fetching latest Poppler release...")
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest'
req = urllib.request.Request(url)
download_url = None

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode())
        assets = data.get('assets', [])
        for asset in assets:
            if asset['name'].endswith('.zip'):
                download_url = asset['browser_download_url']
                break
except Exception as e:
    print(f"Failed to fetch release info: {e}")
    exit(1)

if not download_url:
    print("Could not find a zip file in the latest release.")
    exit(1)

print(f"Downloading from {download_url}...")
try:
    req = urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as response:
        zip_data = response.read()
        print(f"Downloaded {len(zip_data)} bytes. Extracting...")
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zip_ref:
            zip_ref.extractall('poppler')
        print("Done!")
except Exception as e:
    print(f"Failed to download or extract: {e}")
    exit(1)
