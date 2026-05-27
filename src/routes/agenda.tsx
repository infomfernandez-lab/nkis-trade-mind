import { createFileRoute } from '@tanstack/react-router';
import AgendaPage from '@/components/agenda/AgendaPage';

export const Route = createFileRoute('/agenda')({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: 'Agenda — CAP Trading' },
      { name: 'description', content: 'Agenda de tareas y recordatorios de trading.' },
    ],
  }),
});
