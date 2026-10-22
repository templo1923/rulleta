# Despliegue de Ruleta Flex en un hosting propio

## 1. Qué necesitas

La aplicación no es una página HTML estática. Necesita:

- Un servidor que ejecute Node.js 22 o Docker.
- MySQL 8 o MariaDB compatible.
- HTTPS para el dominio y para conservar correctamente la sesión del panel.
- Espacio suficiente en MySQL para las fotos de las reclamaciones.
- Las variables privadas de autenticación y almacenamiento.

Un hosting compartido de cPanel normalmente no es suficiente si no permite ejecutar un proceso Node permanente. Las opciones recomendadas son un VPS, Railway, Render, Fly.io, DigitalOcean App Platform o un servidor con Docker.

## 2. Variables de entorno

Configura estas variables en el proveedor. Nunca las pongas dentro del frontend ni las subas a Git:

```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=NOMBRE_BD
DB_USER=USUARIO
DB_PASS=CONTRASEÑA
RUTA_WEB=https://tu-dominio.com
SESSION_SECRET=...
```

`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASS` son obligatorias para participantes, premios, reclamaciones y usuarios. También se acepta `DATABASE_URL` si tu proveedor la entrega en ese formato.

`SESSION_SECRET` debe ser una cadena privada larga para firmar las sesiones del panel. Se puede generar con:

```bash
openssl rand -hex 32
```

El login administrativo usa correo y contraseña. La aplicación guarda el correo, el nombre, el rol y un hash seguro de la contraseña en MySQL. Nunca se guarda la contraseña original. Crea el primer administrador con `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD`, ejecutando una sola vez `pnpm admin:create`; después elimina `ADMIN_PASSWORD` del entorno.

Genera la clave para firmar sesiones con:

```text
openssl rand -hex 32
```

`SESSION_SECRET` debe permanecer privada y ser diferente en cada instalación. Las fotos se guardarán en la tabla `claimPhotos` de MySQL, sin S3 ni almacenamiento externo.

## 3. Despliegue con Docker

El proyecto ya contiene un `Dockerfile` que instala dependencias, compila el frontend y arranca Express con `dist/index.js`.

En un VPS:

```bash
git clone URL_DEL_REPOSITORIO ruletaflex
cd ruletaflex
cp .env.example .env
# Editar .env con las variables reales
nano .env
docker build -t ruletaflex:latest .
docker run -d \
  --name ruletaflex \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  ruletaflex:latest
```

La aplicación debe responder en:

```text
http://127.0.0.1:3000/api/health
```

Debe devolver un JSON parecido a:

```json
{"status":"ok","app":"ruletaflex"}
```

## 4. Migrar la base de datos

Con las variables `DB_*` configuradas, ejecuta una vez:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
```

En un despliegue Docker, lo más seguro es ejecutar las migraciones como paso separado antes de arrancar la nueva versión, usando una imagen que tenga el código y las mismas variables `DB_*`.

No ejecutes `db:push` automáticamente en cada arranque de producción. Usa migraciones controladas y realiza copia de seguridad de MySQL antes de cambios de esquema.

## 5. Arranque sin Docker

Si el proveedor ofrece Node.js 22:

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
NODE_ENV=production PORT=3000 pnpm start
```

El proceso debe escuchar en `0.0.0.0` y respetar la variable `PORT` que entregue el proveedor.

## 6. Dominio y HTTPS

Configura un registro DNS `A` hacia la IP del VPS, por ejemplo:

```text
ruleta.tudominio.com -> IP_DEL_SERVIDOR
```

Después coloca Nginx, Caddy o el proxy del proveedor delante del puerto 3000. El proxy debe:

- Terminar HTTPS.
- Redirigir el dominio al puerto interno 3000.
- Mantener los encabezados `Host`, `X-Forwarded-Proto` y `X-Forwarded-For`.
- Permitir las rutas `/api/*` y `/admin`.

Con Caddy, el proxy básico sería:

```caddyfile
ruleta.tudominio.com {
    reverse_proxy 127.0.0.1:3000
}
```

## 7. Fotos de reclamaciones

Las fotos se guardan en MySQL en `claimPhotos`. El panel las sirve mediante una ruta protegida y la base de datos conserva también la referencia en `participants.photoUrl`.

## 8. Login del panel

El panel se protege con sesión y roles:

- `admin`: puede configurar campaña, premios, entregas y accesos.
- `user`: no puede entrar al panel.

La autenticación actual usa el OAuth configurado en Manus. Si el hosting será completamente independiente, se debe configurar un proveedor OAuth propio o implementar login por correo y contraseña antes de retirar las variables de Manus.

## 9. Pruebas después del despliegue

Ejecuta:

```bash
curl -fsS https://ruleta.tudominio.com/api/health
curl -fsS https://ruleta.tudominio.com/api/campaign
```

Después prueba manualmente:

1. Abrir la ruleta en móvil.
2. Registrar una participación de prueba.
3. Verificar que el premio visual coincide con el premio registrado.
4. Reclamar un premio.
5. Confirmar que aparece en el panel.
6. Seleccionar asesoría y una plataforma.
7. Confirmar que el panel muestra asesoría, plataforma y foto.
8. Entrar al panel con la cuenta administradora.

## 10. Qué debes enviarme para darte instrucciones exactas

Para convertir esta guía en pasos exactos de tu caso necesito saber:

- Proveedor del hosting.
- Si tienes VPS, cPanel, Docker, Railway, Render u otro panel.
- Si ya tienes MySQL.
- El dominio que usarás.
- Si quieres conservar el login y almacenamiento de Manus o independizarlos también.

La opción más rápida es VPS/Docker conservando las integraciones actuales. La opción más independiente requiere migrar autenticación y almacenamiento.
