"""Regenera la plantilla de Excel sin dependencias externas ni filas ficticias."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape

ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
path = Path('assets/excel/Plantilla_invitados.xlsx')
with ZipFile(path) as original:
    files = {name: original.read(name) for name in original.namelist()}

def cell(ref, text, style=0):
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{escape(text)}</t></is></c>'

files['xl/worksheets/sheet1.xml'] = f'''<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="{ns}"><sheetPr><tabColor rgb="FF173352"/></sheetPr><dimension ref="A1:C1"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/></cols><sheetData><row r="1" ht="32" customHeight="1">{cell('A1','Familia o invitado',1)}{cell('B1','Boletos',1)}{cell('C1','Mesa',1)}</row></sheetData><autoFilter ref="A1:C1"/></worksheet>'''.encode()
notes = ['Tu lista de invitados · Mis XV de Camila', '1. En Invitados, escribe una familia por fila: nombre, boletos (1 a 15) y mesa opcional.', '2. Puedes agregar tus propias columnas. No necesitas escribir códigos ni identificadores.', '3. Sube el archivo al panel y revisa las invitaciones nuevas, los cambios y los conflictos.', '4. Guarda y conserva el Excel que devuelve el panel. Úsalo para futuras correcciones.', '5. Las familias con el mismo nombre tienen invitaciones independientes. El panel te ayudará a distinguirlas.', '6. Los enlaces y las identidades se conservan en el Excel exportado. No borres las columnas ocultas.', '7. La importación no cambia las respuestas de asistencia. Compártelas desde la invitación personalizada.']
rows=''.join(f'<row r="{i}" ht="36" customHeight="1">{cell("A"+str(i),note,1 if i==1 else 0)}</row>' for i,note in enumerate(notes,1))
files['xl/worksheets/sheet2.xml']=f'<worksheet xmlns="{ns}"><dimension ref="A1:A8"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="110" customWidth="1"/></cols><sheetData>{rows}</sheetData></worksheet>'.encode()
files['xl/styles.xml']=f'''<styleSheet xmlns="{ns}"><fonts count="2"><font><sz val="11"/><color rgb="FF173352"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173352"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/></styleSheet>'''.encode()
with ZipFile(path,'w',ZIP_DEFLATED) as output:
    for name,data in files.items():
        output.writestr(name,data)
print('Plantilla regenerada: nombre, boletos, mesa e instrucciones; sin folios visibles.')
