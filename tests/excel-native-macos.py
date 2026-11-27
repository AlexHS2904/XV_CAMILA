"""Apertura/guardado reales en Excel. Los avisos se revisan manualmente si AX no está autorizado.
Requiere antes: node tests/excel-panel-compat.mjs. No abre ni modifica libros ajenos.
"""
from pathlib import Path
import hashlib, json, subprocess, time, sys
from zipfile import ZipFile
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'test-results/excel-compat'
LOGS=Path.home()/'Library/Containers/com.microsoft.Excel/Data/tmp'
NS={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def script(source):
    result=subprocess.run(['osascript','-e','with timeout of 15 seconds\n'+source+'\nend timeout'],capture_output=True,text=True,timeout=20)
    if result.returncode: raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()

def quoted(value): return '"'+str(value).replace('\\','\\\\').replace('"','\\"')+'"'

def repairs(): return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in LOGS.glob('Repair Result to *.xml')}

names=['08-reimportado-desde-excel.xlsx'] if '--reimported' in sys.argv else [item['file'] for item in json.loads((FOLDER/'manifest.json').read_text())]
old_alerts=script('tell application "Microsoft Excel" to get display alerts')
before=repairs()
results=[]
try:
    script('tell application "Microsoft Excel" to set display alerts to true')
    for filename in names:
        path=FOLDER/filename
        original_hash=hashlib.sha256(path.read_bytes()).hexdigest()
        with ZipFile(path) as z:
            sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            expected_links=len(sheet.findall('x:hyperlinks/x:hyperlink',NS))
            expected_tables=len(sheet.findall('x:tableParts/x:tablePart',NS))
            hidden=[c.get('min') for c in sheet.findall('x:cols/x:col',NS) if c.get('hidden')=='1']
        subprocess.run(['open','-a','Microsoft Excel',str(path)],check=True)
        time.sleep(.4)
        exists=False
        for _ in range(10):
            exists=script(f'tell application "Microsoft Excel" to return exists workbook {quoted(filename)}')=='true'
            if exists: break
            time.sleep(.4)
        if not exists: raise RuntimeError('Excel no terminó de abrir '+filename+'; revisar diálogo, no reparar el archivo.')
        info=script(f'''tell application "Microsoft Excel"
 set w to workbook {quoted(filename)}
 set s to worksheet "Invitados" of w
 return ((count of list objects of s) as text) & "," & ((count of hyperlinks of s) as text)
end tell''')
        tables,links=map(int,info.split(','))
        assert (tables,links)==(expected_tables,expected_links),(filename,info,'pérdida de tabla o enlaces')
        for col in hidden:
            result=script(f'tell application "Microsoft Excel" to get hidden of column {col} of worksheet "Invitados" of workbook {quoted(filename)}')
            assert result=='true',(filename,'identificador dejó de estar oculto')
        target=path.with_name(path.stem+'-excel.xlsx')
        if target.exists(): raise RuntimeError('La copia de prueba ya existe; usa una carpeta de prueba nueva: '+target.name)
        script(f'''tell application "Microsoft Excel"
 save workbook as workbook {quoted(filename)} filename ((POSIX file {quoted(target)}) as text) file format Excel XML file format
 close workbook {quoted(target.name)} saving no
end tell''')
        assert hashlib.sha256(path.read_bytes()).hexdigest()==original_hash,'Se alteró el archivo original'
        with ZipFile(target) as z:
            saved_sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            assert len(saved_sheet.findall('x:tableParts/x:tablePart',NS))==expected_tables
            assert len(saved_sheet.findall('x:hyperlinks/x:hyperlink',NS))==expected_links
        assert repairs()==before,'Excel creó o modificó un registro de reparación'
        results.append({'file':filename,'native_open':True,'native_tables':tables,'native_links':links,'hidden_columns':hidden,'saved_by_excel':target.name,'original_unchanged':True,'new_repair_logs':False,'warning_review':'manual pendiente'})
        print(json.dumps(results[-1]),flush=True)
        # Deja el original abierto para la revisión manual de avisos, no una copia reparada.
        subprocess.run(['open','-a','Microsoft Excel',str(path)],check=True)
    (FOLDER/('native-reimport-report.json' if '--reimported' in sys.argv else 'native-report.json')).write_text(json.dumps(results,indent=2))
finally:
    script('tell application "Microsoft Excel" to set display alerts to '+old_alerts)
