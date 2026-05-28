import Link from 'next/link';
import { Play } from 'lucide-react';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-24 max-w-5xl">
      <div className="flex flex-col items-center text-center space-y-8">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter text-zinc-950">
          Feedback de Audio preciso. <br />
          <span className="text-zinc-400">Sin concesiones.</span>
        </h1>
        <p className="max-w-2xl text-lg sm:text-xl text-zinc-600 font-medium">
          Sube tus pistas. Consigue feedback sincronizado con exactitud milimétrica de la mano de profesionales. Mejora tus habilidades de mezcla y producción.
        </p>
        <div className="pt-8">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-zinc-950 text-white px-8 py-4 rounded-full font-medium hover:bg-zinc-800 hover:scale-105 transition-all text-lg"
          >
            <Play size={20} className="fill-current" />
            Probar Demo MVP
          </Link>
        </div>
      </div>
    </div>
  );
}
