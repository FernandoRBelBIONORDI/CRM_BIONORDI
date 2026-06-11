// Motor compartido de exportación PDF para los 4 cotizadores
// (reparación, venta, mantenimiento y consumibles).
//
// El CSS es el motor calibrado de la cotización de reparación de transductores
// (modelo de referencia): 2 páginas exactas con @page 10mm/15mm, .page-two con
// min-height 244mm y pie elástico .page-spacer. El salto a la página 2 debe
// hacerse SIEMPRE con un div separador con estilo inline:
//   <div style="page-break-before: always; break-before: always;"></div>
// y no dentro de la clase .page-two, porque el fallback (html2canvas) detecta
// los saltos por atributo style inline para empujar el contenido al límite de hoja.

export function b64toBlobUrl(b64: string): string {
  const bin = window.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

export async function fetchBase64(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return path; }
}

export async function generarPDFBase64(htmlString: string): Promise<string> {
  // Primario: Puppeteer server-side
  try {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlString }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.base64) return data.base64;
    }
  } catch { /* fallback */ }

  // Fallback: html2canvas + jspdf en el browser
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed", top: "0", left: "-9999px",
      width: "816px", height: "1056px", border: "none", opacity: "0", pointerEvents: "none",
    });
    document.body.appendChild(iframe);
    const cleanup = () => { try { document.body.removeChild(iframe); } catch { } };

    iframe.onload = async () => {
      try {
        await new Promise(r => setTimeout(r, 800));
        const html2canvas = (await import("html2canvas")).default;
        const { jsPDF } = await import("jspdf");
        const doc = iframe.contentDocument;
        if (!doc) { cleanup(); reject(new Error("No se pudo acceder al iframe")); return; }

        const A4_HEIGHT = 1123;
        const elementsToCheck = doc.querySelectorAll('table, [style*="page-break-before:always"], [style*="page-break-before: always"], .avoid-break');

        elementsToCheck.forEach(el => {
          const rect = el.getBoundingClientRect();
          const isPageBreak = el.tagName === 'TABLE' || (el.getAttribute('style') || '').includes('page-break-before');

          if (isPageBreak) {
            const currentPos = rect.top;
            const pageNumber = Math.floor(currentPos / A4_HEIGHT);
            const nextPagePos = (pageNumber + 1) * A4_HEIGHT + 40;
            const pushAmount = nextPagePos - currentPos;
            if (pushAmount > 0 && (currentPos % A4_HEIGHT) > 50) {
              const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(el as Element).marginTop || "0");
              (el as HTMLElement).style.marginTop = `${currentMargin + pushAmount}px`;
            }
          } else {
            const topPage = Math.floor(rect.top / A4_HEIGHT);
            const bottomPage = Math.floor(rect.bottom / A4_HEIGHT);
            if (topPage !== bottomPage) {
              const nextPagePos = bottomPage * A4_HEIGHT + 40;
              const pushAmount = nextPagePos - rect.top;
              const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(el as Element).marginTop || "0");
              (el as HTMLElement).style.marginTop = `${currentMargin + pushAmount}px`;
            }
          }
        });

        const sigEl = doc.querySelector('.signatures-wrapper') as HTMLElement;
        if (sigEl) {
          const rect = sigEl.getBoundingClientRect();
          const bottomPage = Math.floor(rect.bottom / A4_HEIGHT);
          const targetBottom = (bottomPage + 1) * A4_HEIGHT - 50;
          const pushAmount = targetBottom - rect.bottom;
          if (pushAmount > 0) {
            const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(sigEl).marginTop || "0");
            sigEl.style.marginTop = `${currentMargin + pushAmount}px`;
          }
        }

        const canvas = await html2canvas(doc.documentElement, {
          scale: 4, useCORS: true, allowTaint: true,
          width: 816, windowWidth: 816, logging: false,
        });
        const pdf = new jsPDF({ format: "letter", unit: "mm", orientation: "portrait" });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const imgH = (canvas.height * pdfW) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        let y = 0;
        while (y < imgH) {
          if (y > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, -y, pdfW, imgH);
          y += pdfH;
        }
        cleanup();
        resolve(pdf.output("datauristring").split(",")[1]);
      } catch (err) { cleanup(); reject(err); }
    };
    iframe.onerror = () => { cleanup(); reject(new Error("Error al cargar el HTML")); };
    iframe.srcdoc = htmlString;
  });
}

// Div separador de página: única forma soportada de saltar a la página 2.
export const PAGE_BREAK = `<div style="page-break-before: always; break-before: always;"></div>`;

// CSS calibrado del modelo de referencia (cotización de reparación de transductores).
// Superset: incluye todas las clases usadas por los 4 cotizadores.
export const COTIZACION_PDF_CSS = `
  @page{margin:10mm 0 15mm 0}@page:first{margin-top:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{padding:30px 65px;max-width:816px;margin:0 auto;}
  .page-two{padding:30px 65px;max-width:816px;margin:0 auto;display:flex;flex-direction:column;min-height:244mm;}
  .page-spacer{flex:1;}.avoid-break{page-break-inside:avoid;break-inside:avoid;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px}
  .meta-box{text-align:right}
  .doc-title{font-size:18px;font-weight:300;color:#94A3B8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
  .meta-grid{display:grid;grid-template-columns:auto auto;gap:4px 15px;justify-content:end;font-size:11px}
  .meta-lbl{font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px}
  .meta-val{color:#1E293B;font-weight:600}
  .divider{height:4px;background:linear-gradient(90deg,#4E60A9,#38AD64,#E2E8F0);border-radius:4px;margin-bottom:10px}
  .info-section{display:flex;gap:20px;margin-bottom:8px}
  .info-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px 14px}
  .card-title{font-size:10px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:2px solid #E2E8F0;padding-bottom:6px}
  .i-row{display:flex;margin-bottom:5px;font-size:11px;line-height:1.4}
  .i-lbl{width:85px;color:#64748B;font-weight:700}
  .i-val{flex:1;color:#1E293B;font-weight:500}
  .eq-card{background:#fff;border:1px solid #CBD5E1;border-radius:12px;padding:10px 14px;margin-bottom:8px;border-left:4px solid #4E60A9}
  .eq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}
  .eq-item{display:flex;flex-direction:column;gap:4px}
  .eq-lbl{font-size:9px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
  .eq-val{font-size:12px;color:#0F172A;font-weight:600}
  .eq-full{grid-column:span 4;background:#FEF2F2;padding:8px 12px;border-radius:8px;border-left:3px solid #EF4444;margin-top:5px}
  .tech-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px 14px;margin-top:8px;margin-bottom:8px}
  .diag-p{font-size:11px;color:#475569;line-height:1.5;margin-bottom:10px}
  .diag-grid{display:flex;gap:20px;align-items:center}
  .dot{position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;margin:0;}
  .diag-list{flex:1.2;display:flex;flex-direction:column;gap:12px}
  .d-item{display:flex;gap:10px;font-size:10.5px;color:#334155;line-height:1.4;align-items:flex-start}
  .d-num{width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-sizing:border-box;padding:0;}
  .bottom-flex{display:flex;gap:20px;margin-bottom:15px;align-items:flex-start}
  .totals-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px}
  .t-row{display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:8px}
  .t-row .t-val{font-weight:600;color:#1E293B}
  .t-row.final{border-top:2px solid #E2E8F0;padding-top:12px;margin-top:4px;font-size:16px;font-weight:900;color:#4E60A9}
  .t-row.final .t-val{color:#4E60A9}
  .billing-instructions{flex:1;background:#EEF0F7;border:1px solid #C5CAE0;border-radius:12px;padding:12px}
  .billing-instructions .card-title{color:#4E60A9;border-bottom-color:#C5CAE0}
  .b-step{display:flex;gap:8px;font-size:10.5px;color:#4E60A9;margin-bottom:8px;line-height:1.4}
  .b-step strong{font-weight:800}
  .cond-section{margin-bottom:12px;page-break-inside:avoid}
  .cond-title{font-size:11px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .cond-list{list-style:none;padding:0}
  .cond-list li{position:relative;padding-left:14px;font-size:10px;color:#475569;margin-bottom:6px;line-height:1.5}
  .cond-list li::before{content:"•";position:absolute;left:0;color:#38AD64;font-weight:bold;font-size:14px;line-height:1;top:-1px}
  .signatures{margin-top:8px;display:flex;justify-content:flex-end;page-break-inside:avoid}
  .sig-box{text-align:center;width:240px}
  .sig-line{border-top:2px solid #CBD5E1;margin-bottom:10px;padding-top:10px}
  .sig-name{font-size:13px;font-weight:800;color:#4E60A9}
  .sig-role{font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;margin-top:2px}
  .footer{text-align:center;border-top:1px solid #E2E8F0;padding-top:10px;margin-top:10px;font-size:10px;color:#94A3B8;line-height:1.6}
`;
