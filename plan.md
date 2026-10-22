# Ruleta Flex — plan de implementación

## Objetivo

Construir una plataforma de campañas promocionales con una experiencia equivalente a la referencia analizada, pero con una campaña y reglas completamente configurables desde un panel. La primera campaña quedará preparada para usarse con una estética de feria digital, premios editables y captura de participantes.

## Alcance de la primera versión

- Landing pública responsive con ruleta SVG animada.
- Registro de nombre, WhatsApp y correo.
- Validación de datos y control de participación en servidor.
- Selección de premios en servidor con pesos y stock.
- Resultados ganadores, “para la próxima” y “gira de nuevo”.
- Giro extra configurable.
- Reclamación de premio con asesoría, plataforma y foto opcionales.
- Persistencia de participantes y reclamaciones en MySQL gestionado.
- Panel privado basado en la autenticación existente para administrar campañas, configuración visual, premios, reglas y participantes.
- Exportación CSV.
- Almacenamiento de fotos mediante el helper de Storage del proyecto.
- Publicación como contenedor con Express y frontend compilado por Vite.

## Arquitectura

- `client/src/pages/Campaign.tsx`: experiencia pública de campaña.
- `client/src/pages/Admin.tsx`: panel administrativo.
- `client/src/lib/api.ts`: cliente REST tipado para endpoints de campaña y administración.
- `client/src/index.css`: sistema visual responsive.
- `server/campaign.ts`: configuración inicial, selección ponderada y reglas de participación.
- `server/db.ts`: consultas de campaña, participantes y premios.
- `server/_core/index.ts`: endpoints HTTP públicos y administrativos.
- `drizzle/schema.ts`: tablas de campañas, premios, participantes y reclamaciones.
- `client/public/manus-routes.json`: manifiesto de rutas.

## Decisiones de seguridad y operación

- El premio nunca se acepta desde el navegador como autoridad: el servidor crea el giro y conserva el resultado.
- El servidor valida duplicados por correo y WhatsApp dentro de la campaña.
- `localStorage` solo se usa para mejorar la experiencia, nunca para imponer reglas.
- Las fotos se validan por tipo y tamaño; si Storage no está disponible durante desarrollo, la reclamación conserva el flujo y marca la foto como pendiente.
- El panel usa `adminProcedure` y el rol `admin` del starter. La cuenta propietaria de Manus recibe rol administrador cuando inicia sesión según el starter.
- La campaña se inicializa con una configuración estable si la base de datos todavía no tiene registros.

## Diseño

### Tres direcciones consideradas

- **Feria nocturna neón** (<0.08): fondo profundo, luces cálidas y acentos cian para energía promocional.
- **Editorial cálida** (<0.06): marfil, tinta y naranja, con sensación de marca boutique.
- **Tech minimal** (<0.05): blanco, grafito y azul, con foco en claridad administrativa.

### Dirección elegida: Feria nocturna neón

- **Movimiento:** feria digital contemporánea con guiños de tómbola, neón y señalética de evento.
- **Principios:** alto contraste, información en capas, recompensa visible y controles táctiles grandes.
- **Color:** índigo profundo como escenario; dorado para acción y premio; cian y coral para segmentos; verde para confirmaciones.
- **Layout:** columna central de campaña en móvil y split asimétrico en escritorio: ruleta como pieza principal y tarjeta como módulo de participación.
- **Firma visual:** anillo de bombillas, puntero dorado y tarjetas flotantes con textura de grano sutil.
- **Interacción:** cada paso se revela en secuencia; el giro comunica espera, resultado y siguiente acción sin saltos bruscos.
- **Animación:** giro de 5.6 s con desaceleración, brillos suaves en bombillas y entrada escalonada de tarjetas.
- **Tipografía:** Plus Jakarta Sans para texto e interfaz; Space Grotesk para números, premios y encabezados.
- **Esencia:** “Convierte una visita en una oportunidad de marca”; energética, clara y generosa.
- **Voz:** directa, celebratoria y humana. Ejemplos: “Tu oportunidad está a un giro” y “Déjanos tus datos; nosotros nos ocupamos de la entrega”.
- **Wordmark:** “Ruleta Flex” con la letra x convertida en puntero.
- **Color propio:** `#F7C948`, amarillo premio usado en CTA y estados de atención.

## Entrega

La plataforma deberá compilar con `pnpm build`, responder en `/api/health`, servir la landing y el panel, y quedar lista para publicarse desde el checkpoint final.
