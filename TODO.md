# Ruleta Flex — resultados del producto

## Landing pública configurable

- La campaña pública debe mostrar una ruleta responsive con premio, puntero y animación de giro.
- La landing debe renderizar el título, subtítulo, marca, colores, botones, redes y mensajes desde la configuración de campaña.
- La experiencia debe funcionar en móvil y escritorio, con estados separados para datos, giro, reclamación, reintento y finalización.

## Registro y reglas de participación

- El participante debe poder enviar nombre completo, WhatsApp y correo.
- El servidor debe validar los campos y rechazar un registro duplicado por correo o WhatsApp dentro de la campaña.
- La regla de un giro por persona debe aplicarse en servidor; el bloqueo local no puede ser la única protección.

## Ruleta y premios

- El servidor debe seleccionar el resultado con los pesos configurados y guardar el resultado del participante.
- Los premios deben poder ser ganadores, “para la próxima” o “gira de nuevo”.
- Deben respetarse los stocks configurados y no entregar premios agotados.
- Un giro extra debe poder habilitarse según la regla de campaña.

## Reclamación

- El participante ganador debe poder ver el premio y enviar la reclamación.
- La reclamación debe admitir foto opcional, solicitud de asesoría y plataforma de interés.
- El sistema debe guardar el estado, fecha y datos de la reclamación y mostrar un comprobante final.

## Administración

- El panel privado debe permitir consultar participantes y reclamaciones.
- El administrador debe poder editar textos, colores, identidad visual, redes, reglas y mensajes de una campaña.
- El administrador debe poder crear, editar, activar y ordenar premios, pesos, tipos y stock.
- El panel debe permitir exportar participantes y resultados en CSV.

## Persistencia y despliegue

- La aplicación debe guardar la información en la base de datos gestionada cuando está disponible.
- Las fotos deben usar almacenamiento duradero y conservar su URL en la base de datos.
- La aplicación debe responder en `/api/health`, compilar con `pnpm build` y quedar preparada para publicación con Docker.
