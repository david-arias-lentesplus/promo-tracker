"""
📄 /api/_data_service.py  — Servicio compartido de datos CSV
Descarga, parsea y filtra el CSV maestro de Google Drive.
Importado por raw_data.py, stats.py y otros endpoints.
"""
import csv, io, os, re, urllib.request
from datetime import datetime, date as _date

try:
    import requests as _requests
except ImportError:
    _requests = None

# ─── Config ───────────────────────────────────────────────────
GDRIVE_FILE_ID  = "1fs86vREGrlU3KNqYPWKw8-qnthNFWoQU"
GDRIVE_DOWNLOAD = (
    f"https://drive.google.com/uc?export=download&id={GDRIVE_FILE_ID}&confirm=t"
)

# Mapeo código → nombre de país
COUNTRY_NAMES = {
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    # 'GL': 'Galileo',  # Galileo excluido del sistema
    'MX': 'México',
}

# Módulo-level cache de imágenes, tipos y uso (persiste en el mismo proceso)
_IMAGE_CACHE:    dict = {}
_TYPE_CACHE:     dict = {}   # sku -> type
_URL_CACHE:      dict = {}   # sku -> product page url
_USE_TYPE_CACHE: dict = {}   # sku -> use_type
_USE_DUR_CACHE:  dict = {}   # sku -> use_duration
_IMAGE_LOADED:   bool = False
_USE_LOADED:     bool = False

# ─── Helpers internos ─────────────────────────────────────────

def _project_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _parse_js_date(s: str):
    """
    Parsea fechas en múltiples formatos:
      · JS Date.toString(): 'Wed Nov 01 2023 00:00:00 GMT-0500 (Colombia Standard Time)'
      · ISO:                 '2023-11-01'
      · d/m/Y:               '01/11/2023'
    Retorna datetime.date o None.
    """
    if not s or not s.strip():
        return None
    s = s.strip()
    # ISO
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    # JS format: cualquier cosa que tenga "Mmm DD YYYY"
    m = re.search(r'([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})', s)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", '%b %d %Y').date()
        except ValueError:
            pass
    return None


def _parse_discount(val) -> float:
    try:
        v = float(str(val).replace('%', '').strip())
        return v if v <= 1 else v / 100
    except Exception:
        return 0.0


# ─── Carga de imágenes ────────────────────────────────────────

def _fix_url(url: str) -> str:
    """Reescribe URLs de dominios internos distribuidora* a lentesplus.com."""
    if not url:
        return url
    # Mapeo de paths con código de país de 3 letras → 2 letras ISO
    url = url.replace('www.distribuidorazoom.com/col/', 'www.lentesplus.com/co/')
    url = url.replace('www.distribuidorazoom.com/mex/', 'www.lentesplus.com/mx/')
    url = url.replace('www.distribuidoragalileo.com/chl/', 'www.lentesplus.com/cl/')
    # Fallback: cualquier dominio distribuidora* restante
    url = re.sub(r'www\.distribuidorazoom\.com', 'www.lentesplus.com', url)
    url = re.sub(r'www\.distribuidoragalileo\.com', 'www.lentesplus.com', url)
    return url


def load_image_map() -> dict:
    global _IMAGE_CACHE, _TYPE_CACHE, _URL_CACHE, _IMAGE_LOADED
    if _IMAGE_LOADED:
        return _IMAGE_CACHE
    path = os.path.join(_project_root(), 'data', 'url_sku_images.csv')
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            for row in csv.DictReader(f):
                sku     = str(row.get('sku',       '')).strip()
                img_url = str(row.get('url_image', '')).strip()
                prod_url= _fix_url(str(row.get('url', '')).strip())
                ptype   = str(row.get('type',      '')).strip()
                if sku:
                    if img_url:
                        _IMAGE_CACHE[sku]        = img_url
                        _IMAGE_CACHE[sku.upper()] = img_url
                        _IMAGE_CACHE[sku.lower()] = img_url
                    if prod_url:
                        _URL_CACHE[sku]        = prod_url
                        _URL_CACHE[sku.upper()] = prod_url
                        _URL_CACHE[sku.lower()] = prod_url
                    if ptype:
                        _TYPE_CACHE[sku]        = ptype
                        _TYPE_CACHE[sku.upper()] = ptype
                        _TYPE_CACHE[sku.lower()] = ptype
        _IMAGE_LOADED = True
    except Exception as e:
        print(f"[_data_service] Error cargando imágenes: {e}")
    return _IMAGE_CACHE


def get_type_map() -> dict:
    """Retorna el mapa sku→type (cargado junto con load_image_map)."""
    if not _IMAGE_LOADED:
        load_image_map()
    return _TYPE_CACHE


def get_url_map() -> dict:
    """Retorna el mapa sku→product_url (cargado junto con load_image_map)."""
    if not _IMAGE_LOADED:
        load_image_map()
    return _URL_CACHE


# ─── Carga de use_type / use_duration ────────────────────────

def load_use_data() -> None:
    """Carga sku_use_data.csv en _USE_TYPE_CACHE y _USE_DUR_CACHE."""
    global _USE_TYPE_CACHE, _USE_DUR_CACHE, _USE_LOADED
    if _USE_LOADED:
        return
    path = os.path.join(_project_root(), 'data', 'sku_use_data.csv')
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            for row in csv.DictReader(f):
                sku = str(row.get('sku', '')).strip()
                ut  = str(row.get('use_type',     '')).strip()
                ud  = str(row.get('use_duration',  '')).strip()
                if sku:
                    for k in (sku, sku.upper(), sku.lower()):
                        if ut: _USE_TYPE_CACHE[k] = ut
                        if ud: _USE_DUR_CACHE[k]  = ud
        _USE_LOADED = True
    except Exception as e:
        print(f"[_data_service] Error cargando use_data: {e}")


def _get_use(sku: str, cache: dict) -> str:
    if not sku:
        return ''
    return cache.get(sku) or cache.get(sku.upper()) or cache.get(sku.lower()) or ''


# ─── Descarga CSV ─────────────────────────────────────────────

def fetch_csv_text() -> str:
    hdrs = {
        'User-Agent': 'Mozilla/5.0 (compatible; PromoTracker/1.0)',
        'Accept':     'text/csv,text/plain,*/*',
    }
    if _requests:
        r = _requests.get(GDRIVE_DOWNLOAD, headers=hdrs, timeout=25, allow_redirects=True)
        r.raise_for_status()
        text = r.text
    else:
        req = urllib.request.Request(GDRIVE_DOWNLOAD, headers=hdrs)
        with urllib.request.urlopen(req, timeout=25) as resp:
            text = resp.read().decode('utf-8', errors='replace')
    # Normalizar line endings (\r\n → \n)
    return text.replace('\r\n', '\n').replace('\r', '\n')


# ─── Parseo CSV → lista de registros ─────────────────────────

def parse_csv(raw_text: str, image_map: dict) -> list:
    # Asegurar que el cache de uso está cargado
    if not _USE_LOADED:
        load_use_data()

    reader  = csv.DictReader(io.StringIO(raw_text, newline=''))
    records = []
    for i, row in enumerate(reader):
        # ── Filtrar filas inválidas (subtotales de Excel con Date Start vacío) ──
        if not str(row.get('Date Start', '')).strip():
            continue

        sku          = str(row.get('SKU',          '')).strip()
        product_name = str(row.get('Product Name', '')).strip()

        # Detectar filas de Gafas: "Gafas" en Product Name y sin SKU válido
        is_gafas = 'gafas' in product_name.lower() and (not sku or len(sku) < 3)

        # Filtrar filas inválidas: SKU vacío/corto o nombre de BU — salvo Gafas
        if not is_gafas:
            if not sku or len(sku) < 3 or sku in ('Avizor', 'Cooper Vision', 'Opharm'):
                continue

        img = (
            image_map.get(sku)
            or image_map.get(sku.upper())
            or image_map.get(sku.lower())
            or ''
        ) if sku else ''

        url_map  = get_url_map()
        prod_url = (
            url_map.get(sku)
            or url_map.get(sku.upper())
            or url_map.get(sku.lower())
            or ''
        ) if sku else ''

        disc_raw   = _parse_discount(row.get('Total descuentos', 0))
        bu         = str(row.get('Business Unit', '')).strip()
        if bu.upper() == 'GL':           # Galileo excluido del sistema
            continue
        ds_raw     = str(row.get('Date Start', '')).strip()
        de_raw     = str(row.get('Date End',   '')).strip()
        ds_parsed  = _parse_js_date(ds_raw)
        de_parsed  = _parse_js_date(de_raw)

        # product_type: 'Gafas' directo para filas sin SKU, lookup desde _TYPE_CACHE para el resto
        if is_gafas:
            ptype = 'Gafas'
        else:
            ptype = (_TYPE_CACHE.get(sku) or _TYPE_CACHE.get(sku.upper()) or _TYPE_CACHE.get(sku.lower()) or '')

        records.append({
            'id':             i + 1,
            'sku':            sku,
            'product_name':   product_name,
            'fabricante':     str(row.get('Fabricante',      '')).strip(),
            'proveedor':      str(row.get('Proveedor',       '')).strip(),
            'business_unit':  bu,
            'pais':           bu,   # Business Unit contiene código de país
            'pais_nombre':    COUNTRY_NAMES.get(bu, bu),
            'status':         str(row.get('Activo a hoy',    '')).strip(),
            'date_start':     ds_parsed.isoformat() if ds_parsed else ds_raw[:20],
            'date_end':       de_parsed.isoformat() if de_parsed else de_raw[:20],
            '_date_start_d':  ds_parsed,  # objeto date para filtros
            '_date_end_d':    de_parsed,
            'tipo_campana':   str(row.get('Tipo Campaña',    '')).strip(),
            'nombre_campana': str(row.get('Nombre Campaña',  '')).strip(),
            'promo_marca':    str(row.get('Promocion marca', '')).strip(),
            'qty_max':        str(row.get('Qty Max promo',   '')).strip(),
            'desc_marca':     _parse_discount(row.get('Descuento marca',  0)),
            'desc_propio':    _parse_discount(row.get('Descuento propio', 0)),
            'total_desc':     disc_raw,
            'total_desc_pct': round(disc_raw * 100, 1),
            'tipo_promo':     str(row.get('Tipo promo pagina', '')).strip(),
            'url_image':      img,
            'product_url':    prod_url,
            'product_type':   ptype,
            'use_type':       _get_use(sku, _USE_TYPE_CACHE),
            'use_duration':   _get_use(sku, _USE_DUR_CACHE),
        })
    return records


def strip_internal(record: dict) -> dict:
    """Elimina campos internos '_*' antes de serializar a JSON."""
    return {k: v for k, v in record.items() if not k.startswith('_')}


# ─── Filtros ──────────────────────────────────────────────────

def apply_filters(
    records:   list,
    country:   str = '',
    date_from: str = '',
    date_to:   str = '',
    search:    str = '',
    status:    str = '',
    **kwargs,
) -> list:
    out = records

    # 1. País (Business Unit)
    if country and country.lower() not in ('all', 'todos', ''):
        out = [r for r in out if r['pais'].lower() == country.lower()]

    # 2. Rango de fechas (solapamiento): promo_start ≤ filter_end AND promo_end ≥ filter_start
    df = _parse_js_date(date_from) if date_from else None
    dt = _parse_js_date(date_to)   if date_to   else None
    if df or dt:
        filtered = []
        for r in out:
            ps = r.get('_date_start_d')
            pe = r.get('_date_end_d')
            start_ok = (ps is None or dt is None or ps <= dt)
            end_ok   = (pe is None or df is None or pe >= df)
            if start_ok and end_ok:
                filtered.append(r)
        out = filtered

    # 3. Estado
    if status and status.lower() not in ('all', ''):
        out = [r for r in out if r['status'].lower() == status.lower()]

    # 4. Tipo de producto
    if kwargs.get('product_type', ''):
        pt = kwargs['product_type'].lower()
        out = [r for r in out if r.get('product_type','').lower() == pt]

    # 5. Tipo de uso
    if kwargs.get('use_type', ''):
        ut = kwargs['use_type'].lower()
        out = [r for r in out if r.get('use_type','').lower() == ut]

    # 6. Duración de uso
    if kwargs.get('use_duration', ''):
        ud = kwargs['use_duration'].lower()
        out = [r for r in out if r.get('use_duration','').lower() == ud]

    # 7. Búsqueda
    if search:
        q = search.lower()
        out = [r for r in out
               if q in r['sku'].lower()
               or q in r['product_name'].lower()
               or q in r['fabricante'].lower()
               or q in r['nombre_campana'].lower()]

    return out


def get_unique_use_types(records: list) -> list:
    """Retorna lista ordenada de use_type únicos."""
    return sorted({r.get('use_type','').strip() for r in records if r.get('use_type','').strip()})


def get_unique_use_durations(records: list) -> list:
    """Retorna lista ordenada de use_duration únicos."""
    return sorted({r.get('use_duration','').strip() for r in records if r.get('use_duration','').strip()})


def get_unique_types(records: list) -> list:
    """Retorna lista ordenada de tipos de producto únicos con promos activas."""
    seen = set()
    for r in records:
        t = r.get('product_type', '').strip()
        if t:
            seen.add(t)
    return sorted(seen)


def get_unique_countries(records: list) -> list:
    """Retorna lista ordenada de {code, name} — solo códigos de país conocidos."""
    seen = {}
    for r in records:
        code = r.get('pais', '').strip()
        # Solo incluir si es un código de país válido (en COUNTRY_NAMES)
        if code and code in COUNTRY_NAMES and code not in seen:
            seen[code] = COUNTRY_NAMES[code]
    return [{'code': c, 'name': n} for c, n in sorted(seen.items())]
