import { createFileRoute } from '@tanstack/react-router';
import BacktesterPage from '@/components/backtester/BacktesterPage';

export const Route = createFileRoute('/backtester')({
  component: BacktesterPage,
  head: () => ({
    meta: [
      { title: 'Backtester — CAP Trading' },
      { name: 'description', content: 'Importa operaciones.csv o ejecuta tus scripts en tu PC y compara variantes.' },
      { property: 'og:title', content: 'Backtester — CAP Trading' },
      { property: 'og:description', content: 'Importa operaciones.csv y compara variantes de tus sistemas.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
});
