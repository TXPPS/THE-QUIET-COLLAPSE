/** Freesound CC0 cues → hashed MP3s. Short cues are precached; beds and long static stream on first use. */
import { readFileSync } from 'node:fs';
import { mb } from './lib/io.mjs';

const STREAM_SECONDS = 10;

export function buildAudio(manifest, sources) {
  let precached = 0;
  let streamed = 0;
  for (const entry of sources.filter((e) => e.source === 'Freesound')) {
    const file = entry.files[0].to;
    const bytes = readFileSync(file);
    const seconds = Number((entry.modifications.match(/([\d.]+) s\)/) ?? [])[1] ?? 0);
    const precache = seconds < STREAM_SECONDS;
    manifest.emit(`audio.${entry.role}`, { dir: 'audio', name: entry.role, ext: 'mp3', bytes, sources: [entry.id], kind: 'audio', precache, meta: { seconds } });
    if (precache) precached += bytes.length;
    else streamed += bytes.length;
  }
  console.log(`  audio: ${mb(precached)} precached, ${mb(streamed)} streamed`);
}
