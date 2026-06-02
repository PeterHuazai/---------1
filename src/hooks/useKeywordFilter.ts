import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';

let _cache: { blacklist: string[]; whitelist: string[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

async function fetchKeywords() {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache;
  const { data } = await supabase.from('keyword_filters').select('keyword,list_type');
  const blacklist: string[] = [];
  const whitelist: string[] = [];
  for (const row of data || []) {
    if (row.list_type === 'blacklist') blacklist.push(row.keyword.toLowerCase());
    else whitelist.push(row.keyword.toLowerCase());
  }
  _cache = { blacklist, whitelist, ts: Date.now() };
  return _cache;
}

export function useKeywordFilter() {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchKeywords().then(() => setReady(true)).catch(() => setReady(true));
  }, [user]);

  // 检查文本是否包含黑名单关键词（白名单优先）
  // 返回命中的关键词，若为空数组则通过
  const checkContent = useCallback(async (text: string): Promise<string[]> => {
    if (!text.trim()) return [];
    const kws = await fetchKeywords();
    const lower = text.toLowerCase();
    const hits: string[] = [];
    for (const bw of kws.blacklist) {
      if (lower.includes(bw)) {
        // 白名单优先：若命中白名单则跳过
        const inWhite = kws.whitelist.some(ww => lower.includes(ww));
        if (!inWhite) hits.push(bw);
      }
    }
    return hits;
  }, []);

  return { checkContent, ready };
}
