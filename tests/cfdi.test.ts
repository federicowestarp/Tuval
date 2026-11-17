import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCfdi } from "../src/lib/cfdi.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" Serie="A" Folio="1234" SubTotal="250.00" Total="290.00" xmlns:cfdi="http://www.sat.gob.mx/cfd/4">
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="40141700" NoIdentificacion="EM-435-005" Cantidad="10" ClaveUnidad="H87" Descripcion="ADAP HEMBRA 1/2 PVC C40 CR" ValorUnitario="15.00" Importe="150.00"/>
    <cfdi:Concepto NoIdentificacion="EM-436-010" Cantidad="5" Descripcion="ADAP MACHO 1 PVC C40 RC" ValorUnitario="20.00" Importe="100.00"/>
  </cfdi:Conceptos>
</cfdi:Comprobante>`;

test("lee folio, total y conceptos de un CFDI 4.0", () => {
  const c = leerCfdi(XML);
  assert.equal(c.folio, "A-1234");
  assert.equal(c.total, 290);
  assert.equal(c.conceptos.length, 2);
  assert.deepEqual(c.conceptos[0], { codigo: "EM-435-005", descripcion: "ADAP HEMBRA 1/2 PVC C40 CR", cantidad: 10, valorUnitario: 15, importe: 150 });
});
