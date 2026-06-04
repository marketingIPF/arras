# Contrato de Arras · RK Palanca Fontestad

WebApp interna para que los agentes introduzcan los datos del contrato de arras
con formato y validación estandarizados, y exporten un bloque listo para la
automatización a Google Sheets vía Gmail.

Stack: **Vite + React 18 + Tailwind CSS + lucide-react**.

---

## Requisitos

- Node.js 18 o superior

## Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL que muestra la consola (por defecto http://localhost:5173).

## Build de producción

```bash
npm run build      # genera la carpeta dist/
npm run preview    # sirve el build localmente para comprobarlo
```

---

## Despliegue en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En Vercel: **Add New → Project → Import** el repositorio.
3. Vercel detecta **Vite** automáticamente. No hace falta tocar nada:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Deploy**. Cada `git push` a la rama principal vuelve a desplegar solo.

---

## Configuración rápida

Todo lo editable está al principio de **`src/ContratoArras.jsx`**:

- **Email de la automatización** — a dónde se envía el `mailto`:

  ```js
  const EMAIL_AUTOMATIZACION = "mar@inmobiliariapalanca.com";
  ```

- **Lista de agentes** — alimenta los desplegables y el autocompletado del
  email del asesor/a:

  ```js
  const AGENTES = [
    { id: "…", name: "Nombre Apellidos", email: "…@inmobiliariapalanca.com", phone: "…" },
    // …
  ];
  ```

---

## Qué hace la app

- Pantalla inicial para elegir rol: **Agente del Comprador** o **Agente del Vendedor**.
- Saneamiento automático del texto al salir de cada campo:
  - Nombres y apellidos (compradores, vendedores, agentes y nombre para factura) → **MAYÚSCULAS**.
  - DNI / documento / referencia / referencia catastral → mayúsculas sin espacios.
  - IBAN → agrupado de 4 en 4.
  - Importes → formato español con €.
- **Validación**:
  - DNI/NIE con letra de control (módulo 23).
  - IBAN con algoritmo mod-97 + longitud por país.
  - Aviso de arras por debajo de 6.000 € o del 10 % del precio.
- Secciones dinámicas para añadir varios compradores o vendedores.
- Sección final de **Revisión y exportación**:
  - Formato **Texto estructurado** (cabeceras HOJA 1 / HOJA 2) o **JSON**.
  - Botón **Copiar datos para automatización**.
  - Botón **Enviar por email** (mailto prerrellenado).
