'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

function HelloMika() {
  const [count, setCount] = useState(0);

  return (
    <div className='flex flex-col items-center gap-6 py-24'>
      <h1 className='text-6xl font-bold'>Hello Mika</h1>
      <p className='text-lg text-neutral-600'>
        Rendu par un Client Component React.
      </p>
      <Button onClick={() => setCount(c => c + 1)}>
        Cliqué {count} fois
      </Button>
    </div>
  );
}

export default function HelloMikaMount() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('custom-content'));
  }, []);

  if (!target) return null;
  return createPortal(<HelloMika />, target);
}
