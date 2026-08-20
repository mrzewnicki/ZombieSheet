# Firebase Storage CORS (music / Web Audio / waveform backfill)

Playback works without CORS via plain HTMLAudioElement.
These need CORS on the bucket:

- Web Audio EQ (`MediaElementSource` + `crossOrigin`)
- Downloading bytes in the browser (`getBytes` / `fetch`) to build waveforms for already-uploaded tracks

Without CORS, build waveforms at upload time (automatic), via **Waveform from file**, or in **local Vite dev** through the `/__fb_storage` proxy (`vite.config.ts`).

## Apply

Bucket used by the app (see Firebase Console → Storage), typically:

- `zombiesheet-rpg.firebasestorage.app`, or
- `zombiesheet-rpg.appspot.com`

```bash
# Google Cloud SDK required (gsutil)
gsutil cors set storage.cors.json gs://zombiesheet-rpg.firebasestorage.app
# if that bucket name fails:
gsutil cors set storage.cors.json gs://zombiesheet-rpg.appspot.com

gsutil cors get gs://zombiesheet-rpg.firebasestorage.app
```

Origins in `storage.cors.json`: `http://localhost:5173`, `http://127.0.0.1:5173`, `https://mrzewnicki.github.io`.
