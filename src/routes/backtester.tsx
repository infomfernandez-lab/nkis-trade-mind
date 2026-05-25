import { createFileRoute } from '@tanstack/react-router';
import BacktesterPage from '@/components/backtester/BacktesterPage';

export const Route = createFileRoute('/backtester')({
  component: BacktesterPage,
});
