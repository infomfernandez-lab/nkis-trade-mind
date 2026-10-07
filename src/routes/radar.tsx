import { createFileRoute } from '@tanstack/react-router';
import { Radar } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { EscanerView } from '@/components/radar/EscanerView';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Escáner — CAP Trading' },
      { name: 'description', content: 'Foto diaria del escáner CAP: mercados más alcistas y bajistas, señales y liquidez.' },
      { property: 'og:title', content: 'Escáner — CAP Trading' },
      { property: 'og:description', content: 'Foto diaria del escáner CAP: mercados más alcistas y bajistas, señales y liquidez.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
});

function RadarPage() {
  return (
    <div className="space-y-4">
      <StatusBar />
      <div className="flex items-center gap-2">
        <Radar className="w-5 h-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Escáner</h1>
      </div>
      <EscanerView />
    </div>
  );
}
