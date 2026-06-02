import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useBanStatus() {
  const { user } = useAuth();
  const [isBanned, setIsBanned] = useState(false);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setIsBanned(false); setBannedUntil(null); return; }
    supabase
      .from('profiles')
      .select('banned_until')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.banned_until && new Date(data.banned_until) > new Date()) {
          setIsBanned(true);
          setBannedUntil(data.banned_until);
        } else {
          setIsBanned(false);
          setBannedUntil(null);
        }
      });
  }, [user]);

  return { isBanned, bannedUntil };
}
