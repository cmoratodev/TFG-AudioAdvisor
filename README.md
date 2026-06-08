# Audio Advisor

Plataforma web de feedback técnico entre productores musicales. Los usuarios suben sus pistas, otros usuarios escuchan y dejan comentarios anclados al segundo exacto de la forma de onda, y un sistema automático de análisis acústico detecta problemas técnicos objetivos (clipping, dinámica baja, problemas espectrales) en el momento de la subida. Un sistema de rangos competitivos basado en XP fomenta el feedback de calidad.

Proyecto desarrollado como Trabajo de Fin de Grado del Ciclo Formativo de Grado Superior de Desarrollo de Aplicaciones Web (DAW) en el Instituto Tecnológico Granada — Junio 2026.

**Demo en producción**: [tfg-audio-advisor.vercel.app](https://tfg-audio-advisor.vercel.app)

---

## Funcionalidades principales

- **Autenticación completa**: registro con verificación por correo electrónico, inicio de sesión, recuperación de contraseña y eliminación de cuenta (RGPD).
- **Subida y reproducción**: archivos WAV o MP3 de hasta 50 MB, con portada opcional. Reproductor persistente que mantiene la reproducción al navegar entre páginas.
- **Análisis automático del audio**: detección de clipping, picos cercanos al límite, silencios anómalos, dinámica baja y problemas espectrales (mezcla turbia, exceso de agudos, falta de bajos, falta de brillo).
- **Comentarios anclados al segundo**: clic sobre la forma de onda para comentar el instante exacto. Soporte para hilos de respuestas.
- **Sistema de rangos**: siete niveles (de Hierro a Leyenda) que se desbloquean acumulando XP por subir pistas, comentar y recibir marcas de "útil".
- **Notificaciones en tiempo real**: campana con badge de no leídas, actualizada al instante mediante Supabase Realtime.
- **Versionado de pistas**: el autor puede subir nuevas mezclas de una misma pista; los comentarios anteriores permanecen ligados a su versión original.
- **Descubrimiento**: feed público de pistas recientes con filtros por género y búsqueda por título o autor.

---

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| UI | React 19, Tailwind CSS 4, Lucide React |
| Estado cliente | Zustand |
| Base de datos | PostgreSQL gestionado por Supabase |
| ORM | Prisma 7 con driver adapter (`@prisma/adapter-pg`) |
| Autenticación | NextAuth 4 (estrategia JWT, proveedor de credenciales con bcrypt) |
| Almacenamiento | Supabase Storage |
| Tiempo real | Supabase Realtime |
| Correo transaccional | Resend + React Email |
| Decodificación de audio | `audio-decode` |
| Procesado FFT | Implementación propia (Cooley-Tukey, ventana Hann, STFT) |
| Despliegue | Vercel |
| Gestor de paquetes | pnpm |

---

## Estructura del proyecto

```
audio-advisor/
├── prisma/
│   ├── schema.prisma             Esquema relacional + enumerados
│   └── migrations/               Migraciones generadas por Prisma
├── public/
│   └── genres/                   Portadas por defecto por género (WebP)
├── scripts/                      Utilidades one-shot (tsx)
├── src/
│   ├── app/                      Routing del App Router
│   │   ├── api/                  Endpoints REST
│   │   └── ...                   Páginas (Server Components)
│   ├── components/               UI agrupada por dominio
│   ├── emails/                   Plantillas React Email
│   ├── hooks/                    Hooks de React reutilizables
│   ├── lib/                      Lógica de negocio reutilizable
│   ├── store/                    Stores Zustand
│   └── types/                    Tipos TypeScript compartidos
├── next.config.ts
├── package.json
├── prisma.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Puesta en marcha en local

### Requisitos previos

- Node.js 22 LTS o superior.
- pnpm 10 instalado globalmente (`npm install -g pnpm`).
- Una cuenta de [Supabase](https://supabase.com) con un proyecto creado (la base de datos y el bucket de Storage se inicializan con las migraciones que incluye el repositorio).
- Una cuenta de [Resend](https://resend.com) con un dominio verificado para el envío de correos transaccionales.

### Instalación

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/cmoratodev/TFG-AudioAdvisor.git
   cd TFG-AudioAdvisor
   ```

2. Instalar las dependencias:

   ```bash
   pnpm install
   ```

   El script `postinstall` ejecuta `prisma generate` automáticamente.

3. Crear el fichero `.env.local` a partir de la plantilla:

   ```bash
   cp .env.example .env.local
   ```

   Y rellenar los valores reales. Las variables necesarias son:

   ```
   DATABASE_URL                          URL del transaction pooler de Supabase
   NEXT_PUBLIC_SUPABASE_URL              URL pública del proyecto Supabase
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  Clave anon publicada al cliente
   SUPABASE_SERVICE_ROLE_KEY             Clave service_role (sólo servidor)
   NEXTAUTH_URL                          URL pública de la aplicación
   NEXTAUTH_SECRET                       Cualquier string aleatorio largo
   RESEND_API_KEY                        API key de Resend
   RESEND_FROM_EMAIL                     Remitente de los correos transaccionales
   ```

4. Crear el bucket público `tracks` en Supabase Storage.

5. Aplicar las migraciones de Prisma a la base de datos:

   ```bash
   pnpm prisma migrate deploy
   ```

6. Arrancar el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

   La aplicación queda disponible en [http://localhost:3000](http://localhost:3000).

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Arranca el servidor de desarrollo con recarga en caliente. |
| `pnpm build` | Genera el build de producción. |
| `pnpm start` | Sirve el build de producción. |
| `pnpm lint` | Ejecuta ESLint sobre todo el proyecto. |
| `pnpm prisma migrate dev` | Aplica una nueva migración en desarrollo. |
| `pnpm prisma migrate deploy` | Aplica las migraciones pendientes en producción. |
| `pnpm prisma studio` | Abre el panel de administración de la base de datos. |

---

## Despliegue

El proyecto está preparado para desplegarse en Vercel sin configuración adicional:

1. Importar el repositorio desde el dashboard de Vercel.
2. Configurar las variables de entorno (mismo conjunto que `.env.local`, ajustando `NEXTAUTH_URL` a la URL canónica del despliegue de producción).
3. Pulsar **Deploy**. Vercel detecta automáticamente el framework, el gestor de paquetes y ejecuta `prisma generate` mediante el script `postinstall`.

Vercel redepleya automáticamente con cada `git push` a la rama principal.

---

## Autor

**Carlos Morato**
Ciclo Formativo de Grado Superior de Desarrollo de Aplicaciones Web
Instituto Tecnológico Granada — 2026
