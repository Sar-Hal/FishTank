import { useEffect } from 'react';
import { useAppStore } from './state/appStore';
import { Experience } from './ui/Experience';
import { Landing } from './ui/Landing';

const TITLES = {
  landing: 'Fish Tank — Head-Tracked 3D Window',
  experience: 'Fish Tank — Live',
};

export default function App() {
  const stage = useAppStore((state) => state.stage);

  useEffect(() => {
    document.title = TITLES[stage];
  }, [stage]);

  if (stage === 'experience') return <Experience />;
  return <Landing />;
}
