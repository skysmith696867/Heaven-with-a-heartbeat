# Tarocchi Between Us

A two-player multiplayer tarocchi game with private phrase rooms, persistent chat, romantic connection prompts, holographic cards, and Intermission from Heaven breaks.

## What is in this folder

- `app/page.tsx` contains the screens and game interface.
- `app/globals.css` contains the pastel, celestial, holographic design.
- `app/api/game/route.ts` contains the multiplayer room API.
- `lib/tarocchi.ts` contains the deck, rules, scoring, prompts, and intermissions.
- `lib/game-store.ts` contains the saved-room and chat database functions.
- `db/schema.ts` contains the room, player, and message database tables.
- `drizzle/` contains the database migration.

## Put the files in GitHub

1. Unzip this download.
2. Open your empty GitHub repository.
3. Choose **Add file**, then **Upload files**.
4. Upload the contents of the unzipped folder. Keep the folders exactly as they are.
5. Enter a message such as `Add Tarocchi Between Us`.
6. Choose **Commit changes**.

If GitHub mobile will not upload the folders correctly, open the repository in a Codespace, upload the whole unzipped folder through the file sidebar, then use Source Control to commit and sync it.

## Important hosting note

GitHub stores the source code, but GitHub Pages cannot run this multiplayer version by itself. The live rooms and permanent chat require a server and a database. This project currently uses a Cloudflare D1 database through the Sites hosting setup included in the files.

You can safely keep and edit the project in GitHub. When you are ready to publish your own independent copy, connect the repository to a compatible full-stack Cloudflare deployment and create its D1 database. Do not enable ordinary GitHub Pages for this version because the room API will not work there.

## Run it while coding

Install Node.js 22.13 or newer, then run:

```bash
npm install
npm run dev
```

The local multiplayer database requires the included Cloudflare development environment.

## Your current secret phrases

- euphoria whispers
- Heaven sent
- Dance of the fallen stars
- Trace of the secrets
- when time was young and eden was here
- We built this kingdom
- The cards only speak to those who know
- Beep boop bop bop
- Books scream
- Wide eyes
- Sapling of knowledge

## Privacy reminder

Room phrases act like passwords. Anyone who knows a phrase may try to join its room, so share it only with the other player.
