import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Building2, User, UserPlus, Trash2, Mail, Copy, Check, ArrowLeft, ArrowRight,
  ShoppingCart, Store, FileText, Landmark, CreditCard, AlertTriangle, Info,
  ClipboardCheck, Home, Wallet, Send, ChevronDown
} from "lucide-react";

/* ============================================================================
   CONFIGURACIÓN
   ========================================================================== */

// Email de la bandeja de automatización (Apps Script -> Google Sheets).
// Cámbialo por el correo real que dispara la automatización.
const EMAIL_AUTOMATIZACION = "mar@inmobiliariapalanca.com";

const AGENTES = [
  { id: "689033887", name: "Alejandro Garcia", email: "agarcia@inmobiliariapalanca.com", phone: "674054152" },
  { id: "686536270", name: "Amparo Orts Soriano", email: "aorts@inmobiliariapalanca.com", phone: "663323259" },
  { id: "686536262", name: "Asunción Marco Aparisi", email: "asun@inmobiliariapalanca.com", phone: "618644856" },
  { id: "686536303", name: "Clara Ordoñez Rubiols", email: "clara@inmobiliariapalanca.com", phone: "697633537" },
  { id: "689563574", name: "Claudia Stelling", email: "claudia@inmobiliariapalanca.com", phone: "677909467" },
  { id: "687574956", name: "Desiree López Martinez", email: "desiree@inmobiliariapalanca.com", phone: "611575351" },
  { id: "688849218", name: "Eva Vallés", email: "eva@inmobiliariapalanca.com", phone: "637568603" },
  { id: "686536265", name: "Fede Carbonell", email: "fede@inmobiliariapalanca.com", phone: "655299844" },
  { id: "689593800", name: "Fran Estelles", email: "fran@inmobiliariapalanca.com", phone: "670996263" },
  { id: "687702039", name: "Jose Gimenez", email: "josegimenez@inmobiliariapalanca.com", phone: "663716921" },
  { id: "689181578", name: "Lorena Lull", email: "lorena@inmobiliariapalanca.com", phone: "644505020" },
  { id: "686536266", name: "Mª Luisa Bellver", email: "mluisa@inmobiliariapalanca.com", phone: "607067815" },
  { id: "691027263", name: "Maria Jose Ordoñez", email: "mariajose@inmobiliariapalanca.com", phone: "653840768" },
  { id: "692352245", name: "Mariano Del Prado", email: "mariano@inmobiliariapalanca.com", phone: "675992234" },
  { id: "686536275", name: "Mavi Castillo Esteban", email: "mavi@inmobiliariapalanca.com", phone: "622780656" },
  { id: "690617934", name: "Natalia Sanfelix", email: "natalia@inmobiliariapalanca.com", phone: "673647013" },
  { id: "692352252", name: "Nuria Nuñez", email: "nuria@inmobiliariapalanca.com", phone: "675992224" },
  { id: "686536274", name: "Rosa Domenech", email: "rdomenech@inmobiliariapalanca.com", phone: "621206772" },
  { id: "686756864", name: "Sefa Gallent Bestuer", email: "sefa@inmobiliariapalanca.com", phone: "697188343" },
  { id: "686536268", name: "Virginia Corral", email: "vcorral@inmobiliariapalanca.com", phone: "675984757" },
  { id: "692352236", name: "Yvonne Vidal", email: "yvidal@inmobiliariapalanca.com", phone: "675992778" },
].sort((a, b) => a.name.localeCompare(b.name, "es"));

const ORIGENES = ["Área de influencia", "Antiguo Cliente", "Otros", "Oficina", "Verónica"];
const SI_NO = ["Sí", "No"];
const SI_NO_OTRO = ["Sí", "No", "Otro"];

const ARRAS_MINIMO = 6000;

/* ============================================================================
   SANITIZADORES / FORMATEO
   ========================================================================== */

const cleanSpaces = (s = "") => String(s).replace(/\s+/g, " ").trim();

// Partículas que en español se mantienen en minúscula salvo al inicio.
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "van", "von"]);

const toTitleCase = (s = "") =>
  cleanSpaces(s)
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (i > 0 && PARTICULAS.has(w)) return w;
      return w.replace(/^([\p{L}])/u, (c) => c.toUpperCase());
    })
    .join(" ");

// Nombres siempre en MAYÚSCULAS (agentes, compradores y vendedores).
const toUpper = (s = "") => cleanSpaces(s).toUpperCase();

const toDocId = (s = "") => String(s).toUpperCase().replace(/\s+/g, "");

const formatIBAN = (s = "") =>
  String(s)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();

const formatPhone = (s = "") => {
  const d = String(s).replace(/\D+/g, "");
  if (d.length === 9) return d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  return cleanSpaces(s);
};

// Convierte un input "120.000,50" / "120000" / "120000.5" a número.
const parseNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const eur = (v) => {
  const n = typeof v === "number" ? v : parseNumber(v);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
};

const todayES = () =>
  new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

/* ============================================================================
   VALIDACIÓN (DNI/NIE letra de control · IBAN mod-97)
   Devuelven: null (vacío), {ok:true}, {ok:false} o {ok:null} (neutro/no aplica)
   ========================================================================== */

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

const validateDocId = (raw) => {
  const s = toDocId(raw);
  if (!s) return null;
  // DNI: 8 dígitos + letra
  const dni = /^(\d{8})([A-Z])$/.exec(s);
  if (dni) {
    const expected = DNI_LETTERS[parseInt(dni[1], 10) % 23];
    return dni[2] === expected
      ? { ok: true, msg: "DNI válido" }
      : { ok: false, msg: `Letra de control incorrecta (debería ser «${expected}»)` };
  }
  // NIE: X/Y/Z + 7 dígitos + letra
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(s);
  if (nie) {
    const prefix = { X: "0", Y: "1", Z: "2" }[nie[1]];
    const expected = DNI_LETTERS[parseInt(prefix + nie[2], 10) % 23];
    return nie[3] === expected
      ? { ok: true, msg: "NIE válido" }
      : { ok: false, msg: `Letra de control incorrecta (debería ser «${expected}»)` };
  }
  // No encaja con DNI/NIE: puede ser pasaporte u otro documento extranjero.
  return { ok: null, msg: "Sin formato DNI/NIE (¿pasaporte u otro documento?)" };
};

// Longitudes oficiales de IBAN por país (las más habituales aquí).
const IBAN_LENGTHS = {
  ES: 24, PT: 25, FR: 27, DE: 22, IT: 27, GB: 22, NL: 18, BE: 16,
  CH: 21, AD: 24, IE: 22, LU: 20, AT: 20,
};

const validateIBAN = (raw) => {
  const s = String(raw || "").toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return { ok: false, msg: "Formato de IBAN no válido" };
  const country = s.slice(0, 2);
  const expectedLen = IBAN_LENGTHS[country];
  if (expectedLen && s.length !== expectedLen)
    return { ok: false, msg: `Longitud incorrecta (${country} requiere ${expectedLen} caracteres, hay ${s.length})` };
  // mod-97 (ISO 7064): mover 4 primeros al final, letras -> números, resto debe ser 1.
  const rearranged = s.slice(4) + s.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => (c.charCodeAt(0) - 55).toString());
  let remainder = 0;
  for (let i = 0; i < expanded.length; i++) {
    remainder = (remainder * 10 + (expanded.charCodeAt(i) - 48)) % 97;
  }
  return remainder === 1
    ? { ok: true, msg: `IBAN válido${country === "ES" ? " (España)" : ""}` }
    : { ok: false, msg: "Dígitos de control incorrectos" };
};

// result -> estado visual del input
const stateOf = (res) => (res && res.ok === false ? "error" : res && res.ok === true ? "ok" : undefined);

// Dirección postal desglosada en campos.
const emptyAddress = () => ({ calle: "", numero: "", poblacion: "", cp: "" });

const formatCP = (s = "") => String(s).replace(/\D+/g, "").slice(0, 5);

const validateCP = (raw) => {
  const s = String(raw || "").replace(/\D+/g, "");
  if (!s) return null;
  return /^\d{5}$/.test(s) ? null : { ok: false, msg: "El código postal debe tener 5 dígitos" };
};

const addressToText = (a) => {
  if (!a || typeof a !== "object") return a ? String(a) : "—";
  const l1 = [a.calle, a.numero].filter(Boolean).join(", ");
  const l2 = [a.cp, a.poblacion].filter(Boolean).join(" ");
  const full = [l1, l2].filter(Boolean).join(" · ");
  return full || "—";
};

/* ============================================================================
   COMPONENTES DE UI
   ========================================================================== */

function Field({ label, children, hint, required, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[13px] font-semibold text-gray-700 mb-1.5 leading-snug">
        {label} {required && <span style={{ color: "#cf731b" }}>*</span>}
      </span>
      {children}
      {hint && <span className="block text-[12px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

function TextInput({ value, onChange, sanitize, placeholder, type = "text", inputMode, state }) {
  const cls = state === "error" ? " rk-input-error" : state === "ok" ? " rk-input-ok" : "";
  return (
    <input
      type={type}
      inputMode={inputMode}
      className={`rk-input${cls}`}
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={sanitize ? (e) => onChange(sanitize(e.target.value)) : undefined}
    />
  );
}

function Validity({ result }) {
  if (!result) return null;
  if (result.ok === true)
    return (
      <span className="flex items-center gap-1.5 mt-1.5 text-[12px] font-medium" style={{ color: "#16a34a" }}>
        <Check className="w-3.5 h-3.5" /> {result.msg}
      </span>
    );
  if (result.ok === false)
    return (
      <span className="flex items-center gap-1.5 mt-1.5 text-[12px] font-medium" style={{ color: "#b91c1c" }}>
        <AlertTriangle className="w-3.5 h-3.5" /> {result.msg}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 mt-1.5 text-[12px] text-gray-400">
      <Info className="w-3.5 h-3.5" /> {result.msg}
    </span>
  );
}

function CurrencyInput({ value, onChange, placeholder = "0" }) {
  const display = useMemo(() => {
    if (value === "" || value === null || value === undefined) return "";
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(parseNumber(value));
  }, [value]);
  return (
    <div className="relative">
      <input
        className="rk-input pr-9"
        inputMode="decimal"
        placeholder={placeholder}
        value={display}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(parseNumber(e.target.value) || "")}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">€</span>
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3, sanitize }) {
  return (
    <textarea
      className="rk-input resize-y"
      rows={rows}
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={sanitize ? (e) => onChange(sanitize(e.target.value)) : undefined}
    />
  );
}

function Select({ value, onChange, options, placeholder = "Seleccionar…" }) {
  return (
    <div className="relative">
      <select
        className="rk-input appearance-none pr-9 cursor-pointer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function AgentSelect({ value, onChange, placeholder = "Seleccionar agente…" }) {
  return (
    <div className="relative">
      <select
        className="rk-input appearance-none pr-9 cursor-pointer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {AGENTES.map((a) => (
          <option key={a.id} value={a.name.toUpperCase()}>{a.name.toUpperCase()}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function Pills({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active ? "" : o)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              active ? "rk-pill-active shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function CheckRow({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
        checked ? "rk-check-active" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-[5px] border flex items-center justify-center transition-all ${
          checked ? "rk-check-box" : "border-gray-300"
        }`}
      >
        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
      <header className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-gray-50">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(207,115,27,0.10)" }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: "#cf731b" }} />
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{title}</h2>
          {subtitle && <p className="text-[12.5px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </header>
      <div className="p-5 sm:p-6 space-y-5">{children}</div>
    </section>
  );
}

const Grid = ({ children, cols = 2 }) => (
  <div className={`grid grid-cols-1 ${cols === 2 ? "md:grid-cols-2" : ""} gap-x-5 gap-y-5`}>{children}</div>
);

// Dirección postal desglosada: Calle · Número · Población · Código postal
function AddressFields({ label = "Dirección", value, onChange }) {
  const a = value && typeof value === "object" ? value : emptyAddress();
  const set = (k) => (val) => onChange({ ...a, [k]: val });
  const cpRes = validateCP(a.cp);
  return (
    <div className="md:col-span-2">
      <p className="text-[13px] font-semibold text-gray-700 mb-2.5">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
        <Field label="Calle" className="md:col-span-2">
          <TextInput value={a.calle} onChange={set("calle")} sanitize={toTitleCase} placeholder="Nombre de la vía (calle, avenida, plaza…)" />
        </Field>
        <Field label="Número">
          <TextInput value={a.numero} onChange={set("numero")} sanitize={cleanSpaces} placeholder="Nº, piso, puerta…" />
        </Field>
        <Field label="Código postal">
          <TextInput value={a.cp} onChange={set("cp")} sanitize={formatCP} inputMode="numeric" placeholder="46000" state={stateOf(cpRes)} />
          <Validity result={cpRes} />
        </Field>
        <Field label="Población" className="md:col-span-2">
          <TextInput value={a.poblacion} onChange={set("poblacion")} sanitize={toTitleCase} placeholder="Localidad / municipio" />
        </Field>
      </div>
    </div>
  );
}

/* ============================================================================
   AVISO DE ARRAS
   ========================================================================== */

function ArrasWarning({ arras, precio }) {
  const a = parseNumber(arras);
  const p = parseNumber(precio);
  if (!a) return null;
  const belowMin = a < ARRAS_MINIMO;
  const belowPct = p > 0 && a < p * 0.1;
  if (!belowMin && !belowPct) {
    return (
      <div className="flex items-center gap-2 mt-2 text-[12.5px] font-medium" style={{ color: "#16a34a" }}>
        <Check className="w-4 h-4" /> Importe correcto{p > 0 ? ` (${((a / p) * 100).toFixed(1)}% del precio)` : ""}.
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-1.5">
      {belowMin && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium" style={{ backgroundColor: "rgba(220,38,38,0.07)", color: "#b91c1c" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" /> Por debajo del mínimo recomendado de {eur(ARRAS_MINIMO)}.
        </div>
      )}
      {belowPct && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12.5px] font-medium" style={{ backgroundColor: "rgba(207,115,27,0.10)", color: "#a85a13" }}>
          <Info className="w-4 h-4 shrink-0 mt-px" /> Recomendable mínimo 10% del precio de venta ({eur(p * 0.1)}). Actual: {p > 0 ? `${((a / p) * 100).toFixed(1)}%` : "—"}.
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   ESTADO INICIAL
   ========================================================================== */

const emptyBuyer = () => ({
  nombre: "", apellidos: "", facturaNombre: "", facturaImporte: "", dni: "",
  estadoCivil: "", telefono: "", email: "", direccion: emptyAddress(),
});

const emptySeller = () => ({
  nombre: "", porcentaje: "", facturaNombre: "", facturaImporte: "", dni: "",
  telefono: "", email: "", estadoCivil: "", direccion: emptyAddress(), cuenta: "",
});

const initialBuyerForm = () => ({
  agenteComprador: "", agenteVendedor: "", referencia: "", asesor: "", asesorMail: "", origen: "",
  compradores: [emptyBuyer()],
  financiacion: "", porcentaje: "", hipotecaAprobada: "", dependeTasacion: "",
  direccion: emptyAddress(), datosRegistrales: "", refCatastral: "",
  elementos: { garaje: false, trastero: false, otro: false, otroTexto: "" },
  precioVenta: "", arras: "", amueblada: "", inventario: "",
  fechaFirma: "", fechaEscritura: "", notaria: "", suministros: "",
  cuenta: "", observaciones: "",
});

const initialSellerForm = () => ({
  agenteComprador: "", agenteVendedor: "", referencia: "", origen: "", origenExplica: "",
  vendedores: [emptySeller()],
  direccion: emptyAddress(), datosRegistrales: "", refCatastral: "", vpo: "",
  elementos: { garaje: false, trastero: false, otro: false, otroTexto: "" },
  derramas: "", derramasTexto: "", fondoManiobra: "",
  precioVenta: "", precioVivienda: "", precioGaraje: "", precioTrastero: "",
  arras: "", fechaArras: "", fechaEscritura: "", notaria: "",
  conMuebles: "", suministros: "", observaciones: "",
});

/* ============================================================================
   FORMULARIO COMPRADOR
   ========================================================================== */

function BuyerForm({ data, set }) {
  const upd = (k) => (v) => set((d) => ({ ...d, [k]: v }));
  const updBuyer = (i, k) => (v) =>
    set((d) => ({ ...d, compradores: d.compradores.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)) }));
  const addBuyer = () => set((d) => ({ ...d, compradores: [...d.compradores, emptyBuyer()] }));
  const removeBuyer = (i) =>
    set((d) => ({ ...d, compradores: d.compradores.filter((_, idx) => idx !== i) }));
  const updEl = (k) => (v) => set((d) => ({ ...d, elementos: { ...d.elementos, [k]: v } }));

  const onAsesor = (name) => {
    const ag = AGENTES.find((a) => a.name.toUpperCase() === name);
    set((d) => ({ ...d, asesor: name, asesorMail: ag ? ag.email : d.asesorMail }));
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={Building2} title="Información del asesor e inmueble" subtitle="Datos generales de la operación">
        <Grid>
          <Field label="Agente del comprador">
            <AgentSelect value={data.agenteComprador} onChange={upd("agenteComprador")} />
          </Field>
          <Field label="Agente del vendedor">
            <AgentSelect value={data.agenteVendedor} onChange={upd("agenteVendedor")} />
          </Field>
          <Field label="Referencia del inmueble">
            <TextInput value={data.referencia} onChange={upd("referencia")} sanitize={toDocId} placeholder="Ej. REF-12345" />
          </Field>
          <Field label="Origen">
            <Select value={data.origen} onChange={upd("origen")} options={ORIGENES} />
          </Field>
          <Field label="Nombre del asesor/a inmobiliaria">
            <AgentSelect value={data.asesor} onChange={onAsesor} placeholder="Seleccionar asesor/a…" />
          </Field>
          <Field label="Mail del asesor/a inmobiliaria" hint="Se autocompleta al elegir asesor/a">
            <TextInput value={data.asesorMail} onChange={upd("asesorMail")} type="email" placeholder="asesor@inmobiliariapalanca.com" />
          </Field>
        </Grid>
      </SectionCard>

      <SectionCard icon={User} title="Datos de los compradores" subtitle={`${data.compradores.length} ${data.compradores.length === 1 ? "comprador" : "compradores"}`}>
        {data.compradores.map((b, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5 space-y-4 relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[13px] font-bold text-gray-800">
                <span className="w-6 h-6 rounded-lg text-white text-[11px] flex items-center justify-center font-bold" style={{ backgroundColor: "#cf731b" }}>{i + 1}</span>
                Comprador {i + 1}
              </span>
              {data.compradores.length > 1 && (
                <button type="button" onClick={() => removeBuyer(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <Grid>
              <Field label="Nombre">
                <TextInput value={b.nombre} onChange={updBuyer(i, "nombre")} sanitize={toUpper} placeholder="Nombre" />
              </Field>
              <Field label="Apellidos">
                <TextInput value={b.apellidos} onChange={updBuyer(i, "apellidos")} sanitize={toUpper} placeholder="Apellidos" />
              </Field>
              <Field label="DNI / Documento de identidad">
                <TextInput value={b.dni} onChange={updBuyer(i, "dni")} sanitize={toDocId} placeholder="00000000X" state={stateOf(validateDocId(b.dni))} />
                <Validity result={validateDocId(b.dni)} />
              </Field>
              <Field label="Estado civil y régimen matrimonial">
                <TextInput value={b.estadoCivil} onChange={updBuyer(i, "estadoCivil")} sanitize={toTitleCase} placeholder="Ej. Casado/a en gananciales" />
              </Field>
              <Field label="Teléfono">
                <TextInput value={b.telefono} onChange={updBuyer(i, "telefono")} sanitize={formatPhone} type="tel" inputMode="tel" placeholder="600 000 000" />
              </Field>
              <Field label="Email">
                <TextInput value={b.email} onChange={updBuyer(i, "email")} sanitize={(v) => v.trim().toLowerCase()} type="email" placeholder="email@ejemplo.com" />
              </Field>
              <AddressFields label="Dirección del comprador" value={b.direccion} onChange={updBuyer(i, "direccion")} />
              <Field label="Nombre y apellidos para factura">
                <TextInput value={b.facturaNombre} onChange={updBuyer(i, "facturaNombre")} sanitize={toUpper} placeholder="Titular de la factura" />
              </Field>
              <Field label="Importe de la factura (€)">
                <CurrencyInput value={b.facturaImporte} onChange={updBuyer(i, "facturaImporte")} />
              </Field>
            </Grid>
          </div>
        ))}
        <button type="button" onClick={addBuyer} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all hover:bg-orange-50/40" style={{ borderColor: "#f0c79a", color: "#cf731b" }}>
          <UserPlus className="w-4 h-4" /> Añadir comprador
        </button>
      </SectionCard>

      <SectionCard icon={Landmark} title="Financiación">
        <Grid>
          <Field label="¿Necesitan financiación?">
            <Pills value={data.financiacion} onChange={upd("financiacion")} options={SI_NO_OTRO} />
          </Field>
          {(data.financiacion === "Sí" || data.financiacion === "Otro") && (
            <Field label="¿Qué porcentaje? (%)">
              <TextInput value={data.porcentaje} onChange={upd("porcentaje")} inputMode="decimal" placeholder="Ej. 80" />
            </Field>
          )}
          <Field label="¿Tiene hipoteca aprobada?">
            <Pills value={data.hipotecaAprobada} onChange={upd("hipotecaAprobada")} options={SI_NO} />
          </Field>
          <Field label="¿Depende de la tasación?">
            <Pills value={data.dependeTasacion} onChange={upd("dependeTasacion")} options={SI_NO} />
          </Field>
        </Grid>
      </SectionCard>

      <SectionCard icon={Home} title="Datos del inmueble y contrato">
        <Grid>
          <AddressFields label="Dirección del inmueble" value={data.direccion} onChange={upd("direccion")} />
          <Field label="Datos registrales" className="md:col-span-2">
            <Textarea value={data.datosRegistrales} onChange={upd("datosRegistrales")} placeholder="Tomo, libro, folio, finca, inscripción…" />
          </Field>
          <Field label="Referencia catastral">
            <TextInput value={data.refCatastral} onChange={upd("refCatastral")} sanitize={toDocId} placeholder="20 caracteres" />
          </Field>
          <Field label="Notaría">
            <TextInput value={data.notaria} onChange={upd("notaria")} sanitize={toTitleCase} placeholder="Nombre de la notaría" />
          </Field>
          <Field label="Elementos adicionales" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              <CheckRow checked={data.elementos.garaje} onChange={updEl("garaje")} label="Garaje" />
              <CheckRow checked={data.elementos.trastero} onChange={updEl("trastero")} label="Trastero" />
              <CheckRow checked={data.elementos.otro} onChange={updEl("otro")} label="Otro" />
            </div>
            {data.elementos.otro && (
              <div className="mt-2">
                <TextInput value={data.elementos.otroTexto} onChange={updEl("otroTexto")} sanitize={toTitleCase} placeholder="Especificar otro elemento" />
              </div>
            )}
          </Field>
          <Field label="Precio de venta (€)">
            <CurrencyInput value={data.precioVenta} onChange={upd("precioVenta")} />
          </Field>
          <Field label="Entrega de arras (€)" hint={`Mínimo ${eur(ARRAS_MINIMO)}`}>
            <CurrencyInput value={data.arras} onChange={upd("arras")} />
            <ArrasWarning arras={data.arras} precio={data.precioVenta} />
          </Field>
          <Field label="¿Vivienda amueblada o con electrodomésticos?">
            <Pills value={data.amueblada} onChange={upd("amueblada")} options={SI_NO} />
          </Field>
          <Field label="¿Adjunta inventario?">
            <Pills value={data.inventario} onChange={upd("inventario")} options={SI_NO} />
          </Field>
          <Field label="Fecha MÁXIMA firma de contrato (oferta)">
            <input type="date" className="rk-input" value={data.fechaFirma} onChange={(e) => upd("fechaFirma")(e.target.value)} />
          </Field>
          <Field label="Fecha MÁXIMA de escritura">
            <input type="date" className="rk-input" value={data.fechaEscritura} onChange={(e) => upd("fechaEscritura")(e.target.value)} />
          </Field>
          <Field label="Suministros dados de alta">
            <Pills value={data.suministros} onChange={upd("suministros")} options={SI_NO_OTRO} />
          </Field>
          <Field label="Cuenta bancaria (IBAN)">
            <TextInput value={data.cuenta} onChange={upd("cuenta")} sanitize={formatIBAN} placeholder="ES00 0000 0000 0000 0000 0000" state={stateOf(validateIBAN(data.cuenta))} />
            <Validity result={validateIBAN(data.cuenta)} />
          </Field>
          <Field label="Observaciones" className="md:col-span-2">
            <Textarea value={data.observaciones} onChange={upd("observaciones")} placeholder="Cualquier detalle relevante para el contrato" />
          </Field>
        </Grid>
      </SectionCard>
    </div>
  );
}

/* ============================================================================
   FORMULARIO VENDEDOR
   ========================================================================== */

function SellerForm({ data, set }) {
  const upd = (k) => (v) => set((d) => ({ ...d, [k]: v }));
  const updSeller = (i, k) => (v) =>
    set((d) => ({ ...d, vendedores: d.vendedores.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)) }));
  const addSeller = () => set((d) => ({ ...d, vendedores: [...d.vendedores, emptySeller()] }));
  const removeSeller = (i) => set((d) => ({ ...d, vendedores: d.vendedores.filter((_, idx) => idx !== i) }));
  const updEl = (k) => (v) => set((d) => ({ ...d, elementos: { ...d.elementos, [k]: v } }));

  return (
    <div className="space-y-5">
      <SectionCard icon={Building2} title="Información general" subtitle="Datos generales de la operación">
        <Grid>
          <Field label="Agente del comprador">
            <AgentSelect value={data.agenteComprador} onChange={upd("agenteComprador")} />
          </Field>
          <Field label="Agente del vendedor">
            <AgentSelect value={data.agenteVendedor} onChange={upd("agenteVendedor")} />
          </Field>
          <Field label="Referencia del inmueble">
            <TextInput value={data.referencia} onChange={upd("referencia")} sanitize={toDocId} placeholder="Ej. REF-12345" />
          </Field>
          <Field label="Origen">
            <Select value={data.origen} onChange={upd("origen")} options={ORIGENES} />
          </Field>
          {(data.origen === "Otros") && (
            <Field label="Explicación del origen" className="md:col-span-2">
              <Textarea value={data.origenExplica} onChange={upd("origenExplica")} placeholder="Detalle del origen del cliente" rows={2} />
            </Field>
          )}
        </Grid>
      </SectionCard>

      <SectionCard icon={Store} title="Datos de los vendedores" subtitle={`${data.vendedores.length} ${data.vendedores.length === 1 ? "vendedor" : "vendedores"}`}>
        {data.vendedores.map((s, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[13px] font-bold text-gray-800">
                <span className="w-6 h-6 rounded-lg text-white text-[11px] flex items-center justify-center font-bold" style={{ backgroundColor: "#cf731b" }}>{i + 1}</span>
                Vendedor {i + 1}
              </span>
              {data.vendedores.length > 1 && (
                <button type="button" onClick={() => removeSeller(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <Grid>
              <Field label="Nombre y apellidos">
                <TextInput value={s.nombre} onChange={updSeller(i, "nombre")} sanitize={toUpper} placeholder="Nombre y apellidos" />
              </Field>
              <Field label="Porcentaje de propiedad (%)">
                <TextInput value={s.porcentaje} onChange={updSeller(i, "porcentaje")} inputMode="decimal" placeholder="Ej. 50" />
              </Field>
              <Field label="DNI">
                <TextInput value={s.dni} onChange={updSeller(i, "dni")} sanitize={toDocId} placeholder="00000000X" state={stateOf(validateDocId(s.dni))} />
                <Validity result={validateDocId(s.dni)} />
              </Field>
              <Field label="Estado civil y régimen matrimonial">
                <TextInput value={s.estadoCivil} onChange={updSeller(i, "estadoCivil")} sanitize={toTitleCase} placeholder="Ej. Casado/a en gananciales" />
              </Field>
              <Field label="Teléfono">
                <TextInput value={s.telefono} onChange={updSeller(i, "telefono")} sanitize={formatPhone} type="tel" inputMode="tel" placeholder="600 000 000" />
              </Field>
              <Field label="Email">
                <TextInput value={s.email} onChange={updSeller(i, "email")} sanitize={(v) => v.trim().toLowerCase()} type="email" placeholder="email@ejemplo.com" />
              </Field>
              <AddressFields label="Dirección del vendedor" value={s.direccion} onChange={updSeller(i, "direccion")} />
              <Field label="Nombre y apellidos para factura">
                <TextInput value={s.facturaNombre} onChange={updSeller(i, "facturaNombre")} sanitize={toUpper} placeholder="Titular de la factura" />
              </Field>
              <Field label="Importe de la factura (€)">
                <CurrencyInput value={s.facturaImporte} onChange={updSeller(i, "facturaImporte")} />
              </Field>
              <Field label="Nº Cuenta bancaria para ingreso de arras (IBAN)" className="md:col-span-2">
                <TextInput value={s.cuenta} onChange={updSeller(i, "cuenta")} sanitize={formatIBAN} placeholder="ES00 0000 0000 0000 0000 0000" state={stateOf(validateIBAN(s.cuenta))} />
                <Validity result={validateIBAN(s.cuenta)} />
              </Field>
            </Grid>
          </div>
        ))}
        <button type="button" onClick={addSeller} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all hover:bg-orange-50/40" style={{ borderColor: "#f0c79a", color: "#cf731b" }}>
          <UserPlus className="w-4 h-4" /> Añadir vendedor
        </button>
      </SectionCard>

      <SectionCard icon={Home} title="Datos del inmueble y condiciones">
        <Grid>
          <AddressFields label="Dirección del inmueble" value={data.direccion} onChange={upd("direccion")} />
          <Field label="Datos registrales" className="md:col-span-2">
            <Textarea value={data.datosRegistrales} onChange={upd("datosRegistrales")} placeholder="Tomo, libro, folio, finca, inscripción…" />
          </Field>
          <Field label="Referencia catastral">
            <TextInput value={data.refCatastral} onChange={upd("refCatastral")} sanitize={toDocId} placeholder="20 caracteres" />
          </Field>
          <Field label="VPO (Vivienda de Protección Oficial)">
            <Pills value={data.vpo} onChange={upd("vpo")} options={SI_NO} />
          </Field>
          <Field label="Elementos adicionales" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              <CheckRow checked={data.elementos.garaje} onChange={updEl("garaje")} label="Garaje" />
              <CheckRow checked={data.elementos.trastero} onChange={updEl("trastero")} label="Trastero" />
              <CheckRow checked={data.elementos.otro} onChange={updEl("otro")} label="Otro" />
            </div>
            {data.elementos.otro && (
              <div className="mt-2">
                <TextInput value={data.elementos.otroTexto} onChange={updEl("otroTexto")} sanitize={toTitleCase} placeholder="Especificar otro elemento" />
              </div>
            )}
          </Field>
          <Field label="¿Existen derramas en la comunidad?">
            <Pills value={data.derramas} onChange={upd("derramas")} options={SI_NO_OTRO} />
            {(data.derramas === "Sí" || data.derramas === "Otro") && (
              <div className="mt-2">
                <TextInput value={data.derramasTexto} onChange={upd("derramasTexto")} placeholder="Importe / detalle de las derramas" />
              </div>
            )}
          </Field>
          <Field label="¿Existe fondo de maniobra en la comunidad?">
            <TextInput value={data.fondoManiobra} onChange={upd("fondoManiobra")} placeholder="Sí / No / Importe" />
          </Field>
          <Field label="Precio de venta (€)">
            <CurrencyInput value={data.precioVenta} onChange={upd("precioVenta")} />
          </Field>
          <Field label="Notaría">
            <TextInput value={data.notaria} onChange={upd("notaria")} sanitize={toTitleCase} placeholder="Nombre de la notaría" />
          </Field>

          {(data.elementos.garaje || data.elementos.trastero) && (
            <div className="md:col-span-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
              <p className="text-[13px] font-bold text-gray-800">Desglose de precio por finca registral</p>
              <Grid>
                <Field label="Precio VIVIENDA (€)">
                  <CurrencyInput value={data.precioVivienda} onChange={upd("precioVivienda")} />
                </Field>
                {data.elementos.garaje && (
                  <Field label="Precio GARAJE (€)">
                    <CurrencyInput value={data.precioGaraje} onChange={upd("precioGaraje")} />
                  </Field>
                )}
                {data.elementos.trastero && (
                  <Field label="Precio TRASTERO (€)">
                    <CurrencyInput value={data.precioTrastero} onChange={upd("precioTrastero")} />
                  </Field>
                )}
              </Grid>
            </div>
          )}

          <Field label="Entrega de arras (€)" hint={`Mínimo ${eur(ARRAS_MINIMO)}`}>
            <CurrencyInput value={data.arras} onChange={upd("arras")} />
            <ArrasWarning arras={data.arras} precio={data.precioVenta} />
          </Field>
          <Field label="¿Se vende con muebles / electrodomésticos?">
            <Pills value={data.conMuebles} onChange={upd("conMuebles")} options={SI_NO} />
          </Field>
          <Field label="Fecha MÁXIMA de arras (según reserva)">
            <input type="date" className="rk-input" value={data.fechaArras} onChange={(e) => upd("fechaArras")(e.target.value)} />
          </Field>
          <Field label="Fecha MÁXIMA de escritura">
            <input type="date" className="rk-input" value={data.fechaEscritura} onChange={(e) => upd("fechaEscritura")(e.target.value)} />
          </Field>
          <Field label="Suministros dados de alta">
            <Pills value={data.suministros} onChange={upd("suministros")} options={SI_NO_OTRO} />
          </Field>
          <Field label="Observaciones" className="md:col-span-2">
            <Textarea value={data.observaciones} onChange={upd("observaciones")} placeholder="Cualquier detalle relevante para el contrato" />
          </Field>
        </Grid>
      </SectionCard>
    </div>
  );
}

/* ============================================================================
   CONSTRUCCIÓN DEL PAYLOAD (TEXTO + JSON)
   ========================================================================== */

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const elementosToText = (el) => {
  const out = [];
  if (el.garaje) out.push("Garaje");
  if (el.trastero) out.push("Trastero");
  if (el.otro) out.push(`Otro${el.otroTexto ? ` (${el.otroTexto})` : ""}`);
  return out.length ? out.join(", ") : "—";
};
const v = (x) => (x === "" || x === null || x === undefined ? "—" : x);

function buildBuyerPayload(d) {
  const lines = [];
  lines.push("=========================================");
  lines.push("CONTRATO DE ARRAS · RK PALANCA FONTESTAD");
  lines.push("=========================================");
  lines.push(`Rol: AGENTE DEL COMPRADOR`);
  lines.push(`Fecha de envío: ${todayES()}`);
  lines.push(`Referencia inmueble: ${v(d.referencia)}`);
  lines.push("");
  lines.push("----- HOJA 1: DATOS DEL COMPRADOR -----");
  lines.push("");
  lines.push("[INFORMACIÓN GENERAL]");
  lines.push(`Agente del comprador: ${v(d.agenteComprador)}`);
  lines.push(`Agente del vendedor: ${v(d.agenteVendedor)}`);
  lines.push(`Asesor/a: ${v(d.asesor)}`);
  lines.push(`Mail asesor/a: ${v(d.asesorMail)}`);
  lines.push(`Origen: ${v(d.origen)}`);
  lines.push("");
  d.compradores.forEach((b, i) => {
    lines.push(`[COMPRADOR ${i + 1}]`);
    lines.push(`Nombre: ${v(b.nombre)}`);
    lines.push(`Apellidos: ${v(b.apellidos)}`);
    lines.push(`DNI/Documento: ${v(b.dni)}`);
    lines.push(`Estado civil y régimen: ${v(b.estadoCivil)}`);
    lines.push(`Teléfono: ${v(b.telefono)}`);
    lines.push(`Email: ${v(b.email)}`);
    lines.push(`Dirección: ${addressToText(b.direccion)}`);
    lines.push(`Factura a nombre de: ${v(b.facturaNombre)} | Importe: ${b.facturaImporte ? eur(b.facturaImporte) : "—"}`);
    lines.push("");
  });
  lines.push("[FINANCIACIÓN]");
  lines.push(`¿Necesitan financiación?: ${v(d.financiacion)}`);
  lines.push(`Porcentaje: ${d.porcentaje ? d.porcentaje + " %" : "—"}`);
  lines.push(`¿Hipoteca aprobada?: ${v(d.hipotecaAprobada)}`);
  lines.push(`¿Depende de tasación?: ${v(d.dependeTasacion)}`);
  lines.push("");
  lines.push("[INMUEBLE Y CONTRATO]");
  lines.push(`Dirección: ${addressToText(d.direccion)}`);
  lines.push(`Datos registrales: ${v(d.datosRegistrales)}`);
  lines.push(`Ref. catastral: ${v(d.refCatastral)}`);
  lines.push(`Elementos adicionales: ${elementosToText(d.elementos)}`);
  lines.push(`Precio de venta: ${d.precioVenta ? eur(d.precioVenta) : "—"}`);
  lines.push(`Entrega de arras: ${d.arras ? eur(d.arras) : "—"}`);
  lines.push(`Amueblada/electrodomésticos: ${v(d.amueblada)}`);
  lines.push(`Adjunta inventario: ${v(d.inventario)}`);
  lines.push(`Fecha máx. firma contrato: ${v(fmtDate(d.fechaFirma))}`);
  lines.push(`Fecha máx. escritura: ${v(fmtDate(d.fechaEscritura))}`);
  lines.push(`Notaría: ${v(d.notaria)}`);
  lines.push(`Suministros dados de alta: ${v(d.suministros)}`);
  lines.push(`Cuenta bancaria (IBAN): ${v(d.cuenta)}`);
  lines.push(`Observaciones: ${v(d.observaciones)}`);
  const text = lines.join("\n");

  const json = {
    meta: { rol: "AGENTE_COMPRADOR", fecha: todayES(), referencia: d.referencia },
    hoja: "HOJA_1_COMPRADORES",
    informacionGeneral: {
      agenteComprador: d.agenteComprador, agenteVendedor: d.agenteVendedor,
      asesor: d.asesor, asesorMail: d.asesorMail, origen: d.origen,
    },
    compradores: d.compradores.map((b) => ({
      nombre: b.nombre, apellidos: b.apellidos, dni: b.dni, estadoCivil: b.estadoCivil,
      telefono: b.telefono, email: b.email, direccion: b.direccion,
      facturaNombre: b.facturaNombre, facturaImporte: parseNumber(b.facturaImporte),
    })),
    financiacion: {
      necesita: d.financiacion, porcentaje: d.porcentaje,
      hipotecaAprobada: d.hipotecaAprobada, dependeTasacion: d.dependeTasacion,
    },
    inmueble: {
      direccion: d.direccion, datosRegistrales: d.datosRegistrales, refCatastral: d.refCatastral,
      elementos: elementosToText(d.elementos), precioVenta: parseNumber(d.precioVenta),
      arras: parseNumber(d.arras), amueblada: d.amueblada, inventario: d.inventario,
      fechaFirma: d.fechaFirma, fechaEscritura: d.fechaEscritura, notaria: d.notaria,
      suministros: d.suministros, cuenta: d.cuenta, observaciones: d.observaciones,
    },
  };
  return { text, json };
}

function buildSellerPayload(d) {
  const lines = [];
  lines.push("=========================================");
  lines.push("CONTRATO DE ARRAS · RK PALANCA FONTESTAD");
  lines.push("=========================================");
  lines.push(`Rol: AGENTE DEL VENDEDOR`);
  lines.push(`Fecha de envío: ${todayES()}`);
  lines.push(`Referencia inmueble: ${v(d.referencia)}`);
  lines.push("");
  lines.push("----- HOJA 2: DATOS DEL VENDEDOR -----");
  lines.push("");
  lines.push("[INFORMACIÓN GENERAL]");
  lines.push(`Agente del comprador: ${v(d.agenteComprador)}`);
  lines.push(`Agente del vendedor: ${v(d.agenteVendedor)}`);
  lines.push(`Origen: ${v(d.origen)}`);
  if (d.origenExplica) lines.push(`Explicación origen: ${d.origenExplica}`);
  lines.push("");
  d.vendedores.forEach((s, i) => {
    lines.push(`[VENDEDOR ${i + 1}]`);
    lines.push(`Nombre y apellidos: ${v(s.nombre)}`);
    lines.push(`Porcentaje propiedad: ${s.porcentaje ? s.porcentaje + " %" : "—"}`);
    lines.push(`DNI: ${v(s.dni)}`);
    lines.push(`Estado civil y régimen: ${v(s.estadoCivil)}`);
    lines.push(`Teléfono: ${v(s.telefono)}`);
    lines.push(`Email: ${v(s.email)}`);
    lines.push(`Dirección: ${addressToText(s.direccion)}`);
    lines.push(`Factura a nombre de: ${v(s.facturaNombre)} | Importe: ${s.facturaImporte ? eur(s.facturaImporte) : "—"}`);
    lines.push(`Cuenta arras (IBAN): ${v(s.cuenta)}`);
    lines.push("");
  });
  lines.push("[INMUEBLE Y CONDICIONES]");
  lines.push(`Dirección: ${addressToText(d.direccion)}`);
  lines.push(`Datos registrales: ${v(d.datosRegistrales)}`);
  lines.push(`Ref. catastral: ${v(d.refCatastral)}`);
  lines.push(`VPO: ${v(d.vpo)}`);
  lines.push(`Elementos adicionales: ${elementosToText(d.elementos)}`);
  lines.push(`Derramas: ${v(d.derramas)}${d.derramasTexto ? ` (${d.derramasTexto})` : ""}`);
  lines.push(`Fondo de maniobra: ${v(d.fondoManiobra)}`);
  lines.push(`Precio de venta: ${d.precioVenta ? eur(d.precioVenta) : "—"}`);
  if (d.elementos.garaje || d.elementos.trastero) {
    lines.push(`  · Precio vivienda: ${d.precioVivienda ? eur(d.precioVivienda) : "—"}`);
    if (d.elementos.garaje) lines.push(`  · Precio garaje: ${d.precioGaraje ? eur(d.precioGaraje) : "—"}`);
    if (d.elementos.trastero) lines.push(`  · Precio trastero: ${d.precioTrastero ? eur(d.precioTrastero) : "—"}`);
  }
  lines.push(`Entrega de arras: ${d.arras ? eur(d.arras) : "—"}`);
  lines.push(`Se vende con muebles/electrodomésticos: ${v(d.conMuebles)}`);
  lines.push(`Fecha máx. arras (reserva): ${v(fmtDate(d.fechaArras))}`);
  lines.push(`Fecha máx. escritura: ${v(fmtDate(d.fechaEscritura))}`);
  lines.push(`Notaría: ${v(d.notaria)}`);
  lines.push(`Suministros dados de alta: ${v(d.suministros)}`);
  lines.push(`Observaciones: ${v(d.observaciones)}`);
  const text = lines.join("\n");

  const json = {
    meta: { rol: "AGENTE_VENDEDOR", fecha: todayES(), referencia: d.referencia },
    hoja: "HOJA_2_VENDEDORES",
    informacionGeneral: {
      agenteComprador: d.agenteComprador, agenteVendedor: d.agenteVendedor,
      origen: d.origen, origenExplica: d.origenExplica,
    },
    vendedores: d.vendedores.map((s) => ({
      nombre: s.nombre, porcentaje: s.porcentaje, dni: s.dni, estadoCivil: s.estadoCivil,
      telefono: s.telefono, email: s.email, facturaNombre: s.facturaNombre,
      facturaImporte: parseNumber(s.facturaImporte), direccion: s.direccion, cuenta: s.cuenta,
    })),
    inmueble: {
      direccion: d.direccion, datosRegistrales: d.datosRegistrales, refCatastral: d.refCatastral,
      vpo: d.vpo, elementos: elementosToText(d.elementos),
      derramas: d.derramas, derramasTexto: d.derramasTexto, fondoManiobra: d.fondoManiobra,
      precioVenta: parseNumber(d.precioVenta),
      precioVivienda: parseNumber(d.precioVivienda),
      precioGaraje: parseNumber(d.precioGaraje),
      precioTrastero: parseNumber(d.precioTrastero),
      arras: parseNumber(d.arras), conMuebles: d.conMuebles,
      fechaArras: d.fechaArras, fechaEscritura: d.fechaEscritura, notaria: d.notaria,
      suministros: d.suministros, observaciones: d.observaciones,
    },
  };
  return { text, json };
}

/* ============================================================================
   REVISIÓN Y EXPORTACIÓN
   ========================================================================== */

function ReviewExport({ role, data }) {
  const [format, setFormat] = useState("texto"); // 'texto' | 'json'
  const [copied, setCopied] = useState(false);

  const { text, json } = useMemo(
    () => (role === "comprador" ? buildBuyerPayload(data) : buildSellerPayload(data)),
    [role, data]
  );
  const jsonStr = useMemo(() => JSON.stringify(json, null, 2), [json]);
  const payload = format === "texto" ? text : jsonStr;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const sendMail = () => {
    const ref = data.referencia ? ` [${data.referencia}]` : "";
    const subject = `Datos Contrato de Arras · ${role === "comprador" ? "COMPRADOR (Hoja 1)" : "VENDEDOR (Hoja 2)"}${ref}`;
    const url = `mailto:${encodeURIComponent(EMAIL_AUTOMATIZACION)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(payload)}`;
    window.location.href = url;
  };

  return (
    <SectionCard icon={ClipboardCheck} title="Revisión y exportación" subtitle="Revisa el payload antes de enviarlo a la automatización">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-gray-700 mr-1">Formato:</span>
        {["texto", "json"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border transition-all ${
              format === f ? "rk-pill-active" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {f === "texto" ? "Texto estructurado" : "JSON"}
          </button>
        ))}
      </div>

      <pre className="rk-payload">{payload}</pre>

      {!EMAIL_AUTOMATIZACION && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12.5px]" style={{ backgroundColor: "rgba(207,115,27,0.08)", color: "#a85a13" }}>
          <Info className="w-4 h-4 shrink-0 mt-px" />
          Define <code className="font-mono">EMAIL_AUTOMATIZACION</code> en el código para que el botón de email apunte a la bandeja correcta.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={copy} className="rk-btn-primary flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all">
          {copied ? <><Check className="w-4 h-4" /> ¡Copiado!</> : <><Copy className="w-4 h-4" /> Copiar datos para automatización</>}
        </button>
        <button type="button" onClick={sendMail} className="rk-btn-ghost flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all">
          <Send className="w-4 h-4" /> Enviar por email
        </button>
      </div>
    </SectionCard>
  );
}

/* ============================================================================
   PANTALLA DE SELECCIÓN DE ROL
   ========================================================================== */

function RoleSelect({ onPick }) {
  const cards = [
    { id: "comprador", title: "Soy Agente del Comprador", desc: "Datos del comprador, financiación e inmueble (Hoja 1).", icon: ShoppingCart },
    { id: "vendedor", title: "Soy Agente del Vendedor", desc: "Datos de los vendedores y condiciones de venta (Hoja 2).", icon: Store },
  ];
  return (
    <div className="max-w-3xl mx-auto px-5 pt-16 pb-24">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 shadow-sm" style={{ backgroundColor: "#cf731b" }}>
          <FileText className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-[26px] sm:text-[30px] font-extrabold text-gray-900 tracking-tight">
          Gestión de Datos para Contrato de Arras
        </h1>
        <p className="text-gray-500 mt-2.5 text-[15px]">Seleccione su rol para iniciar el formulario</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="group text-left bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-1 hover:shadow-[0_1px_3px_rgba(0,0,0,0.05),0_18px_40px_-18px_rgba(207,115,27,0.35)]"
            style={{ animation: `rkfade .5s ease both ${idx * 90}ms` }}
          >
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-colors" style={{ backgroundColor: "rgba(207,115,27,0.10)" }}>
              <c.icon className="w-6 h-6" style={{ color: "#cf731b" }} />
            </span>
            <h3 className="text-[17px] font-bold text-gray-900">{c.title}</h3>
            <p className="text-[13.5px] text-gray-500 mt-1.5 leading-relaxed">{c.desc}</p>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold mt-4 transition-transform group-hover:translate-x-1" style={{ color: "#cf731b" }}>
              Comenzar <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        ))}
      </div>
      <p className="text-center text-[12px] text-gray-300 mt-10">RK Palanca Fontestad · by Realmark Inmobiliaria</p>
    </div>
  );
}

/* ============================================================================
   APP
   ========================================================================== */

export default function ContratoArrasApp() {
  const [role, setRole] = useState(null); // null | 'comprador' | 'vendedor'
  const [buyer, setBuyer] = useState(initialBuyerForm);
  const [seller, setSeller] = useState(initialSellerForm);
  const topRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      .rk-input{width:100%;padding:.62rem .8rem;border:1px solid #e5e7eb;border-radius:.7rem;font-size:.93rem;background:#fff;color:#111827;transition:border-color .15s ease,box-shadow .15s ease;font-family:inherit;}
      .rk-input::placeholder{color:#9ca3af;}
      .rk-input:focus{outline:none;border-color:#cf731b;box-shadow:0 0 0 3px rgba(207,115,27,.15);}
      .rk-input-error{border-color:#dc2626;}
      .rk-input-error:focus{border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.15);}
      .rk-input-ok{border-color:#16a34a;}
      .rk-input-ok:focus{border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.15);}
      .rk-pill-active{background:#cf731b!important;color:#fff!important;border-color:#cf731b!important;}
      .rk-check-active{background:rgba(207,115,27,.08)!important;border-color:#cf731b!important;color:#a85a13!important;}
      .rk-check-box{background:#cf731b!important;border-color:#cf731b!important;}
      .rk-btn-primary{background:#cf731b;color:#fff;box-shadow:0 8px 20px -10px rgba(207,115,27,.7);}
      .rk-btn-primary:hover{background:#b86316;}
      .rk-btn-ghost{background:#fff;color:#374151;border:1px solid #e5e7eb;}
      .rk-btn-ghost:hover{border-color:#cf731b;color:#cf731b;}
      .rk-payload{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;background:#0f1115;color:#e5e7eb;border-radius:.9rem;padding:1rem 1.1rem;max-height:340px;overflow:auto;}
      @keyframes rkfade{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (role && topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [role]);

  const data = role === "comprador" ? buyer : seller;
  const setData = role === "comprador" ? setBuyer : setSeller;

  return (
    <div className="min-h-screen" style={{ fontFamily: "Montserrat, system-ui, sans-serif", backgroundColor: "#f6f6f4" }}>
      {!role ? (
        <RoleSelect onPick={setRole} />
      ) : (
        <div ref={topRef}>
          {/* Cabecera */}
          <header className="sticky top-0 z-20 backdrop-blur-md bg-white/85 border-b border-gray-100">
            <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center gap-3">
              <button onClick={() => setRole(null)} className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-800 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Cambiar rol
              </button>
              <span className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-bold text-white" style={{ backgroundColor: "#cf731b" }}>
                {role === "comprador" ? <ShoppingCart className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                {role === "comprador" ? "Agente del Comprador" : "Agente del Vendedor"}
              </span>
            </div>
          </header>

          <main className="max-w-3xl mx-auto px-4 sm:px-5 pt-6 pb-24 space-y-5">
            {role === "comprador" ? (
              <BuyerForm data={buyer} set={setBuyer} />
            ) : (
              <SellerForm data={seller} set={setSeller} />
            )}
            <ReviewExport role={role} data={data} />
            <p className="text-center text-[12px] text-gray-300 pt-2">RK Palanca Fontestad · Gestión de Arras</p>
          </main>
        </div>
      )}
    </div>
  );
}
