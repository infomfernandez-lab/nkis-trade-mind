import { createFileRoute } from '@tanstack/react-router';
import AssetsPage from '@/components/activos/AssetsPage';

export const Route = createFileRoute('/activos/')({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: 'Activos — CAP Trading' },
      { name: 'description', content: 'Inventario de instrumentos del escáner.' },
    ],
  }),
});
