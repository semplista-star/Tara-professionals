# Tara — Taulell de l'equip

Aplicació completa (Next.js + PostgreSQL + Vercel Blob) per als 5 creadors del projecte Tara:
tauler de tasques assignables entre membres, xat compartit amb imatges/arxius/notes de veu,
i perfil personal amb foto i contrasenya pròpia.

Aquesta ja **no** és un prototip: les contrasenyes es guarden xifrades (bcrypt) a una base de
dades real, i els fitxers es guarden a un servei d'emmagatzematge real (Vercel Blob). Pensada
per aguantar anys d'ús, no és un joguet de sessió.

---

## 1. Requisits previs

- Un compte de [Vercel](https://vercel.com) (el pla gratuït ja serveix per començar).
- Node.js 20+ instal·lat al teu ordinador (per fer el `db:seed` inicial).
- Aquest codi pujat a un repositori de GitHub (Vercel es connecta directament a GitHub).

## 2. Crear el projecte a Vercel

1. Puja aquesta carpeta a un repo nou de GitHub.
2. A Vercel: **Add New → Project** i importa el repo.
3. Deixa el framework preset com a "Next.js". Encara no li donis a "Deploy" — primer cal la base de dades.

## 3. Base de dades (Postgres)

Des del dashboard del projecte a Vercel: **Storage → Create Database → Postgres**
(o fes servir [Neon](https://neon.tech) o [Supabase](https://supabase.com), també van bé).

Un cop creada, Vercel afegeix automàticament la variable `DATABASE_URL` al projecte.
Si fas servir Neon/Supabase, copia tu mateix la connection string a
**Settings → Environment Variables → DATABASE_URL**.

## 4. Emmagatzematge de fitxers (Vercel Blob)

**Storage → Create Database → Blob**. Vercel afegeix automàticament `BLOB_READ_WRITE_TOKEN`.
Això és el que fa servir el xat per guardar imatges, arxius i notes de veu.

## 5. Variables d'entorn

A **Settings → Environment Variables**, assegura't que hi ha:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | (l'ha posat Vercel Postgres, o la teva de Neon/Supabase) |
| `BLOB_READ_WRITE_TOKEN` | (l'ha posat Vercel Blob) |
| `NEXTAUTH_SECRET` | genera'n un amb `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://el-teu-domini.vercel.app` (actualitza-ho quan tinguis el domini final) |

## 6. Crear les taules i els 5 usuaris

Al teu ordinador, dins la carpeta del projecte:

```bash
npm install
npx vercel env pull .env.local   # baixa les variables reals del projecte de Vercel
npx prisma db push               # crea les taules a la base de dades
```

Abans de fer el seed, **edita `prisma/seed.ts`** i posa els correus i contrasenyes
provisionals reals dels 5 membres (cadascú les hauria de canviar després, des de "El meu perfil").

```bash
npm run db:seed
```

## 7. Desplegar

Torna a Vercel i fes clic a **Deploy**. Un cop desplegat, cada persona entra a
`https://el-teu-domini.vercel.app` amb el seu correu i contrasenya.

---

## Què inclou

- **Login amb correu i contrasenya** (contrasenyes xifrades amb bcrypt, mai en text pla).
- **Tauler de tasques** (Pendent / En curs / Fet), amb prioritat, data límit i comentaris.
  Qualsevol membre pot crear una tasca i assignar-la a un altre sense entrar al seu perfil.
- **Xat compartit** amb text, imatges, arxius i notes de veu (gravades des del navegador).
- **Perfil personal**: cada membre puja la seva pròpia foto i pot canviar la seva contrasenya.

## Com funciona el "temps real"

El xat i el tauler es refresquen automàticament cada 4-8 segons (polling), no amb websockets.
És la opció més senzilla de mantenir a llarg termini per a un equip de 5 persones. Si més
endavant voleu missatges instantanis de veritat, es pot afegir [Pusher](https://pusher.com) o
[Ably](https://ably.com) sense canviar la resta de l'app — pregunta-m'ho quan hi arribeu.

## Límits actuals a tenir en compte

- Fitxers de fins a 20MB (configurable a `src/app/api/upload/route.ts`).
- No hi ha recuperació de contrasenya per correu (per ara, qui administri el projecte pot
  resetejar-la manualment des de la base de dades o afegint un script petit).
- Un sol canal de xat compartit (no hi ha xats privats ni canals per tema, encara).

Qualsevol d'aquests tres punts es pot ampliar més endavant sense refer l'aplicació.
