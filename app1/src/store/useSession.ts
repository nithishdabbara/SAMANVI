import { useEffect, useState } from 'react';
import { getSession, subscribe } from './session';

export function useSession() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  return getSession();
}
