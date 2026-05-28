'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlayerStore } from '@/store/usePlayerStore';
import { Play, Activity, Music, Compass } from 'lucide-react';

const MOCK_EXPLORE_TRACKS = [
  { id: 'exp-1', title: 'Neon Horizon', author: 'Synthwave Kid', genre: 'Electrónica', audioUrl: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'exp-2', title: 'Midnight Echoes', author: 'Jane Producer', genre: 'Pop', audioUrl: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'exp-3', title: 'Urban Drift', author: 'DJ Kicks', genre: 'Hip Hop', audioUrl: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'exp-4', title: 'Acoustic Sunrise', author: 'The Folks', genre: 'Acústico', audioUrl: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'exp-5', title: 'Deep Tech Groove', author: 'Minimalist', genre: 'Electrónica', audioUrl: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'exp-6', title: 'Vintage Keys', author: 'Keys Master', genre: 'Jazz', audioUrl: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
];

const GENRES = ['Todos', 'Electrónica', 'Pop', 'Hip Hop', 'Acústico', 'Jazz'];

export default function ExplorePage() {
  const [activeGenre, setActiveGenre] = useState('Todos');
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const filteredTracks = activeGenre === 'Todos' 
    ? MOCK_EXPLORE_TRACKS 
    : MOCK_EXPLORE_TRACKS.filter(t => t.genre === activeGenre);

  return (
    <div className="container py-10 max-w-5xl mx-auto">
      <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full text-zinc-600 text-sm font-medium mb-4">
            <Compass size={16} />
            <span>Descubrimiento</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Explorar Pistas</h1>
          <p className="text-zinc-500 font-medium text-lg max-w-xl">Descubre nuevos talentos, escucha canciones en proceso y ofrece tu feedback técnico para ayudarles a subir de nivel.</p>
        </div>
      </div>

      {/* Categories / Genres */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 custom-scrollbar">
        {GENRES.map(genre => (
          <button
            key={genre}
            onClick={() => setActiveGenre(genre)}
            className={`px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-colors border ${
              activeGenre === genre 
                ? 'bg-zinc-950 text-white border-zinc-950' 
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-950'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Grid of Tracks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filteredTracks.map(track => {
          const isPlayingThis = currentTrack?.id === track.id;
          
          return (
            <div key={track.id} className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-zinc-300 transition-colors shadow-sm hover:shadow-md">
              <div className="aspect-square bg-zinc-50 relative flex items-center justify-center border-b border-zinc-100">
                <Music size={48} className="text-zinc-200" />
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Link 
                    href={`/track/${track.id}`}
                    className="w-12 h-12 rounded-full bg-white border border-zinc-200 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white flex items-center justify-center text-zinc-950 shadow-sm transition-all"
                    title="Abrir Onda y Feedback"
                  >
                    <Activity size={20} />
                  </Link>
                  <button
                    onClick={() => playTrack({ ...track }, filteredTracks.map(t => ({ ...t })))}
                    className="w-12 h-12 rounded-full bg-white border border-zinc-200 text-zinc-950 hover:bg-zinc-950 hover:border-zinc-950 hover:text-white hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm transition-all"
                    title="Reproducir de Fondo"
                  >
                    <Play size={20} className="translate-x-[2px]" />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <Link href={`/track/${track.id}`} className="font-bold tracking-tight text-lg text-zinc-950 hover:underline">
                      {track.title}
                    </Link>
                    <p className="text-zinc-500 font-medium">{track.author}</p>
                  </div>
                  {isPlayingThis && (
                    <div className="flex gap-[2px] h-4 items-end" title="Reproduciendo ahora">
                      <div className="w-1 bg-zinc-950 animate-[bounce_1s_infinite_0ms] h-full rounded-t-sm" />
                      <div className="w-1 bg-zinc-950 animate-[bounce_1s_infinite_0.2s] h-3/4 rounded-t-sm" />
                      <div className="w-1 bg-zinc-950 animate-[bounce_1s_infinite_0.4s] h-full rounded-t-sm" />
                    </div>
                  )}
                </div>
                
                <span className="inline-block px-2.5 py-1 bg-zinc-100 rounded-md text-xs font-semibold text-zinc-600 mt-2">
                  {track.genre}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredTracks.length === 0 && (
         <div className="py-20 text-center text-zinc-500">
           <Compass size={40} className="mx-auto mb-4 opacity-20" />
           <p>No se han encontrado pistas de este género.</p>
         </div>
      )}
    </div>
  );
}
