import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  DoorOpen, Users, ShoppingBag, Search, Plus, MapPin,
  Phone, Calendar, Megaphone, Eye
} from 'lucide-react';
import type { Classroom, ClubActivity, SecondHand, LostFound, CampusNews } from '@/types/types';
import LoginPromptModal from '@/components/LoginPromptModal';
import CommentsSection from '@/components/CommentsSection';

// ─────────────────────────────────────────────────────────────
// 空教室查询模块
// ─────────────────────────────────────────────────────────────
const DAY_NAMES = ['周一','周二','周三','周四','周五','周六','周日'];

function ClassroomTab() {
  const [building, setBuilding] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [queryTime, setQueryTime] = useState('08:00');
  const [results, setResults] = useState<Classroom[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('classrooms').select('building').then(({ data }) => {
      if (data) setBuildings([...new Set(data.map(r => r.building))]);
    });
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    // 查询在指定 day_of_week 且 queryTime 在 start_time~end_time 之间有空闲时段的教室
    const { data, error } = await supabase
      .from('classrooms')
      .select('*, slots:classroom_slots(*)')
      .ilike('building', building ? `%${building}%` : '%');

    if (error) { toast.error('查询失败'); setLoading(false); return; }

    // 过滤有匹配时段的教室
    const dow = parseInt(dayOfWeek);
    const t = queryTime;
    const matched = (data || []).filter((room: any) =>
      (room.slots || []).some((s: any) =>
        s.day_of_week === dow && s.start_time <= t && s.end_time > t
      )
    );
    setResults(matched);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#E5E6EB] p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-[#165DFF]" /> 查询条件
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>楼栋（可不填查全部）</Label>
            <Select value={building} onValueChange={setBuilding}>
              <SelectTrigger><SelectValue placeholder="全部楼栋" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部楼栋</SelectItem>
                {buildings.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>星期</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>时间点</Label>
            <Input type="time" value={queryTime} onChange={e => setQueryTime(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4 bg-[#165DFF] hover:bg-[#165DFF]/90" onClick={handleSearch} disabled={loading}>
          <Search className="w-4 h-4 mr-2" /> 查询空闲教室
        </Button>
      </div>

      {searched && (
        <div>
          {loading ? (
            <p className="text-gray-500 text-sm">查询中...</p>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>当前时段暂无空闲教室</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">找到 <span className="text-[#165DFF] font-semibold">{results.length}</span> 间空闲教室</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {results.map(room => (
                  <Card key={room.id} className="border-[#E5E6EB] hover:border-[#165DFF]/50 transition-colors">
                    <CardContent className="p-4">
                      <p className="font-bold text-gray-800 text-lg">{room.room_name}</p>
                      <p className="text-sm text-gray-500 mt-1">{room.building} · {room.floor}楼</p>
                      <div className="flex items-center gap-1 mt-2">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-400">可容纳 {room.capacity} 人</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!searched && (
        <div className="text-center py-16 text-gray-400">
          <img src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_343e71d5-2f23-4ba1-8533-4b741a5d1246.jpg"
            className="w-48 h-32 object-cover rounded-xl mx-auto mb-4 opacity-60" alt="空教室" />
          <p className="text-sm">选择楼栋、星期和时间，查询当前空闲教室</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 社团活动模块
// ─────────────────────────────────────────────────────────────
function ActivitiesTab({ onRequireLogin }: { onRequireLogin: (action: string) => void }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClubActivity | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ title:'', club_name:'', description:'', location:'', start_time:'', end_time:'', signup_deadline:'', poster_url:'' });

  const load = async () => {
    const { data } = await supabase
      .from('club_activities')
      .select('*, signups:activity_signups(count)')
      .order('start_time', { ascending: false })
      .limit(50);
    if (data) {
      setActivities(data.map((a: any) => ({ ...a, signup_count: a.signups?.[0]?.count || 0 })));
    }
  };

  useEffect(() => { load(); }, []);

  const handleSignup = async (activityId: string) => {
    if (!user) { onRequireLogin('报名活动'); return; }
    const { error } = await supabase.from('activity_signups').insert({ activity_id: activityId, user_id: user.id });
    if (error) { toast.error('报名失败，可能已报名过'); return; }
    toast.success('报名成功！');
    load();
  };

  const handlePublish = async () => {
    if (!user) { onRequireLogin('发布活动'); return; }
    if (!form.title || !form.club_name || !form.start_time) { toast.error('请填写必填项'); return; }
    const { error } = await supabase.from('club_activities').insert({
      ...form, published_by: user.id,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      signup_deadline: form.signup_deadline || null,
      poster_url: form.poster_url || null,
    });
    if (error) { toast.error('发布失败'); return; }
    toast.success('活动发布成功！');
    setPublishing(false);
    setForm({ title:'', club_name:'', description:'', location:'', start_time:'', end_time:'', signup_deadline:'', poster_url:'' });
    load();
  };

  const filtered = activities.filter(a =>
    !search || a.title.includes(search) || a.club_name.includes(search)
  );

  if (selected) return (
    <div>
      <Button variant="ghost" onClick={() => setSelected(null)} className="mb-4 text-[#165DFF]">← 返回列表</Button>
      <Card className="border-[#E5E6EB]">
        {selected.poster_url && (
          <img src={selected.poster_url} className="w-full h-48 object-cover rounded-t-xl" alt="海报" />
        )}
        <CardContent className="p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{selected.title}</h2>
              <p className="text-[#165DFF] font-medium mt-1">{selected.club_name}</p>
            </div>
            <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0">{selected.signup_count} 人已报名</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
            {selected.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{selected.location}</div>}
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{new Date(selected.start_time).toLocaleString('zh-CN')}</div>
            {selected.signup_deadline && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />报名截止：{new Date(selected.signup_deadline).toLocaleString('zh-CN')}</div>}
          </div>
          {selected.description && <p className="text-gray-700 leading-relaxed">{selected.description}</p>}
          {/* 所有人可见报名按钮，未登录时弹窗提示 */}
          <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={() => handleSignup(selected.id)}>
            立即报名
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="搜索活动名称或社团..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* 发布活动：所有人可见，未登录时弹窗提示 */}
        {user ? (
          <Dialog open={publishing} onOpenChange={setPublishing}>
            <DialogTrigger asChild>
              <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90 shrink-0"><Plus className="w-4 h-4 mr-1" />发布活动</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
              <DialogHeader><DialogTitle>发布社团活动</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {[['活动名称 *', 'title', 'text'], ['社团名称 *', 'club_name', 'text'], ['活动地点', 'location', 'text'], ['海报图片链接', 'poster_url', 'text']].map(([label, key, type]) => (
                  <div key={key} className="space-y-1"><Label>{label}</Label>
                    <Input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                {[['开始时间 *', 'start_time'], ['结束时间', 'end_time'], ['报名截止时间', 'signup_deadline']].map(([label, key]) => (
                  <div key={key} className="space-y-1"><Label>{label}</Label>
                    <Input type="datetime-local" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="space-y-1"><Label>活动描述</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
              </div>
              <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={handlePublish}>发布</Button>
            </DialogContent>
          </Dialog>
        ) : (
          <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90 shrink-0" onClick={() => onRequireLogin('发布活动')}>
            <Plus className="w-4 h-4 mr-1" />发布活动
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <img src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_a79919cb-cd00-48de-9b9c-9a8884cb1460.jpg"
            className="w-48 h-32 object-cover rounded-xl mx-auto mb-4 opacity-60" alt="社团活动" />
          <p className="text-sm">暂无活动，快来发布第一个活动吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(act => (
            <Card key={act.id} className="border-[#E5E6EB] hover:border-[#165DFF]/40 transition-colors cursor-pointer h-full flex flex-col"
              onClick={() => setSelected(act)}>
              {act.poster_url && <img src={act.poster_url} className="w-full h-36 object-cover rounded-t-xl" alt="" />}
              <CardContent className="p-4 flex-1 flex flex-col">
                <div className="flex-1">
                  <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs mb-2">{act.club_name}</Badge>
                  <h3 className="font-semibold text-gray-800 text-balance">{act.title}</h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(act.start_time).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                    {act.location && <><MapPin className="w-3.5 h-3.5 ml-2" /><span>{act.location}</span></>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E5E6EB]">
                  <span className="text-xs text-gray-400">{act.signup_count} 人已报名</span>
                  <span className="text-xs text-[#165DFF]">查看详情 →</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 二手交易模块
// ─────────────────────────────────────────────────────────────
const SH_CATEGORIES = ['全部','书籍','电子','生活','服饰','其他'];

function SecondHandTab({ onRequireLogin }: { onRequireLogin: (action: string) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<SecondHand[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');
  const [selected, setSelected] = useState<SecondHand | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', price:'', category:'书籍', image_url:'', contact:'' });

  const load = async () => {
    const { data } = await supabase
      .from('second_hand')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(60);
    setItems(data || []);
  };

  useEffect(() => { load(); }, []);

  const handlePublish = async () => {
    if (!user) { onRequireLogin('发布闲置物品'); return; }
    if (!form.title || !form.price || !form.contact) { toast.error('请填写必填项'); return; }
    const { error } = await supabase.from('second_hand').insert({
      user_id: user.id, ...form,
      price: parseFloat(form.price) || 0,
      image_url: form.image_url || null,
    });
    if (error) { toast.error('发布失败'); return; }
    toast.success('发布成功！');
    setPublishing(false);
    setForm({ title:'', description:'', price:'', category:'书籍', image_url:'', contact:'' });
    load();
  };

  const filtered = items.filter(i => {
    if (category !== '全部' && i.category !== category) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (selected) return (
    <div>
      <Button variant="ghost" onClick={() => setSelected(null)} className="mb-4 text-[#165DFF]">← 返回列表</Button>
      <Card className="border-[#E5E6EB]">
        {selected.image_url && <img src={selected.image_url} className="w-full h-56 object-cover rounded-t-xl" alt="商品图片" />}
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge className="bg-gray-100 text-gray-600 border-0 mb-2">{selected.category}</Badge>
              <h2 className="text-xl font-bold text-gray-800">{selected.title}</h2>
            </div>
            <span className="text-2xl font-bold text-[#FF7D00]">¥{Number(selected.price).toFixed(2)}</span>
          </div>
          {selected.description && <p className="text-gray-600 leading-relaxed">{selected.description}</p>}
          <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-lg p-3">
            <Phone className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700 font-medium">联系方式：{selected.contact}</span>
          </div>
          <p className="text-xs text-gray-400">发布于 {new Date(selected.created_at).toLocaleString('zh-CN')}</p>
          <CommentsSection postType="secondhand" postId={selected.id} onRequireLogin={onRequireLogin} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="搜索物品..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {SH_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${category === c ? 'bg-[#165DFF] text-white' : 'bg-white border border-[#E5E6EB] text-gray-600 hover:border-[#165DFF]/50'}`}>
              {c}
            </button>
          ))}
        </div>
        {/* 发布闲置：所有人可见，未登录弹窗提示 */}
        {user ? (
          <Dialog open={publishing} onOpenChange={setPublishing}>
            <DialogTrigger asChild>
              <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90 shrink-0"><Plus className="w-4 h-4 mr-1" />发布闲置</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
              <DialogHeader><DialogTitle>发布二手物品</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1"><Label>物品名称 *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="space-y-1"><Label>分类 *</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['书籍','电子','生活','服饰','其他'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>价格（元）*</Label><Input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                <div className="space-y-1"><Label>联系方式 *</Label><Input placeholder="微信/手机号/QQ" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} /></div>
                <div className="space-y-1"><Label>图片链接</Label><Input placeholder="https://..." value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
                <div className="space-y-1"><Label>物品描述</Label><Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={handlePublish}>发布</Button>
            </DialogContent>
          </Dialog>
        ) : (
          <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90 shrink-0" onClick={() => onRequireLogin('发布闲置物品')}>
            <Plus className="w-4 h-4 mr-1" />发布闲置
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <img src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_aa88ca6e-fecb-4779-8c36-561489c01efb.jpg"
            className="w-48 h-32 object-cover rounded-xl mx-auto mb-4 opacity-60" alt="二手交易" />
          <p className="text-sm">暂无物品，发布你的第一件闲置吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => (
            <Card key={item.id} className="border-[#E5E6EB] hover:border-[#165DFF]/40 transition-colors cursor-pointer overflow-hidden h-full flex flex-col"
              onClick={() => setSelected(item)}>
              {item.image_url
                ? <img src={item.image_url} className="w-full h-36 object-cover" alt={item.title} />
                : <div className="w-full h-36 bg-[#F5F7FA] flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-300" /></div>
              }
              <CardContent className="p-3 flex-1 flex flex-col">
                <p className="font-medium text-gray-800 text-sm line-clamp-2 flex-1">{item.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[#FF7D00] font-bold">¥{Number(item.price).toFixed(2)}</span>
                  <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">{item.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 失物招领模块
// ─────────────────────────────────────────────────────────────
function LostFoundTab({ onRequireLogin }: { onRequireLogin: (action: string) => void }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<LostFound[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all'|'lost'|'found'>('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'closed'>('all');
  const [selected, setSelected] = useState<LostFound | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState({ post_type:'lost', title:'', description:'', location:'', contact:'' });

  const load = async () => {
    const { data } = await supabase.from('lost_found').select('*').eq('is_deleted', false).order('created_at', { ascending: false }).limit(60);
    setPosts(data || []);
  };

  useEffect(() => { load(); }, []);

  const handlePublish = async () => {
    if (!user) { onRequireLogin('发布失物招领信息'); return; }
    if (!form.title || !form.contact) { toast.error('请填写必填项'); return; }
    const { error } = await supabase.from('lost_found').insert({ user_id: user.id, ...form, location: form.location || null });
    if (error) { toast.error('发布失败'); return; }
    toast.success('发布成功！');
    setPublishing(false);
    setForm({ post_type:'lost', title:'', description:'', location:'', contact:'' });
    load();
  };

  const markClosed = async (id: string) => {
    const { error } = await supabase.from('lost_found').update({ status: 'closed' }).eq('id', id).eq('user_id', user!.id);
    if (error) { toast.error('操作失败'); return; }
    toast.success('已标记为已找到！');
    load();
    setSelected(null);
  };

  const filtered = posts.filter(p => {
    if (typeFilter !== 'all' && p.post_type !== typeFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  if (selected) return (
    <div>
      <Button variant="ghost" onClick={() => setSelected(null)} className="mb-4 text-[#165DFF]">← 返回列表</Button>
      <Card className="border-[#E5E6EB]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={selected.post_type === 'lost' ? 'bg-red-100 text-red-600 border-0' : 'bg-green-100 text-green-600 border-0'}>
              {selected.post_type === 'lost' ? '失物' : '招领'}
            </Badge>
            <Badge className={selected.status === 'open' ? 'bg-blue-100 text-blue-600 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
              {selected.status === 'open' ? '寻找中' : '已找到'}
            </Badge>
          </div>
          <h2 className="text-xl font-bold text-gray-800">{selected.title}</h2>
          {selected.description && <p className="text-gray-600 leading-relaxed">{selected.description}</p>}
          {selected.location && (
            <div className="flex items-center gap-2 text-gray-600"><MapPin className="w-4 h-4 text-gray-400" />{selected.location}</div>
          )}
          <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-lg p-3">
            <Phone className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700 font-medium">联系方式：{selected.contact}</span>
          </div>
          <p className="text-xs text-gray-400">发布于 {new Date(selected.created_at).toLocaleString('zh-CN')}</p>
          {user && user.id === selected.user_id && selected.status === 'open' && (
            <Button variant="outline" className="w-full" onClick={() => markClosed(selected.id)}>
              标记为已找到
            </Button>
          )}
          <CommentsSection postType="lostfound" postId={selected.id} onRequireLogin={onRequireLogin} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <div className="flex gap-2">
          {[['全部','all'],['失物','lost'],['招领','found']].map(([label, val]) => (
            <button key={val} onClick={() => setTypeFilter(val as any)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${typeFilter === val ? 'bg-[#165DFF] text-white' : 'bg-white border border-[#E5E6EB] text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[['全部状态','all'],['寻找中','open'],['已找到','closed']].map(([label, val]) => (
            <button key={val} onClick={() => setStatusFilter(val as any)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === val ? 'bg-gray-700 text-white' : 'bg-white border border-[#E5E6EB] text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {/* 发布信息：所有人可见，未登录弹窗提示 */}
        {user ? (
          <Dialog open={publishing} onOpenChange={setPublishing}>
            <DialogTrigger asChild>
              <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90 shrink-0"><Plus className="w-4 h-4 mr-1" />发布信息</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
              <DialogHeader><DialogTitle>发布失物招领</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>类型 *</Label>
                  <Select value={form.post_type} onValueChange={v => setForm(f => ({ ...f, post_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="lost">失物（我丢了东西）</SelectItem><SelectItem value="found">招领（我捡到东西）</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>标题 *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="如：丢失黑色充电宝" /></div>
                <div className="space-y-1"><Label>丢失/拾到地点</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="如：图书馆三楼" /></div>
                <div className="space-y-1"><Label>联系方式 *</Label><Input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="微信/手机号" /></div>
                <div className="space-y-1"><Label>详细描述</Label><Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <Button className="w-full bg-[#165DFF] hover:bg-[#165DFF]/90 mt-2" onClick={handlePublish}>发布</Button>
            </DialogContent>
          </Dialog>
        ) : (
          <Button className="bg-[#165DFF] hover:bg-[#165DFF]/90 shrink-0" onClick={() => onRequireLogin('发布失物招领信息')}>
            <Plus className="w-4 h-4 mr-1" />发布信息
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <img src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_a1ee5246-6a80-4214-b211-642e7b615c91.jpg"
            className="w-48 h-32 object-cover rounded-xl mx-auto mb-4 opacity-60" alt="失物招领" />
          <p className="text-sm">暂无信息</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id} onClick={() => setSelected(post)}
              className="bg-white border border-[#E5E6EB] rounded-xl p-4 flex items-start gap-4 cursor-pointer hover:border-[#165DFF]/40 transition-colors">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${post.post_type === 'lost' ? 'bg-red-50' : 'bg-green-50'}`}>
                <Search className={`w-5 h-5 ${post.post_type === 'lost' ? 'text-red-500' : 'text-green-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{post.title}</span>
                  <Badge className={post.post_type === 'lost' ? 'bg-red-100 text-red-600 border-0' : 'bg-green-100 text-green-600 border-0'}>
                    {post.post_type === 'lost' ? '失物' : '招领'}
                  </Badge>
                  {post.status === 'closed' && <Badge className="bg-gray-100 text-gray-500 border-0">已找到</Badge>}
                </div>
                {post.location && <p className="text-sm text-gray-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{post.location}</p>}
                <p className="text-xs text-gray-400 mt-1">{new Date(post.created_at).toLocaleDateString('zh-CN')}</p>
              </div>
              <span className="text-xs text-[#165DFF] shrink-0">查看 →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 校园资讯模块
// ─────────────────────────────────────────────────────────────
function NewsTab() {
  const [news, setNews] = useState<CampusNews[]>([]);
  const [selected, setSelected] = useState<CampusNews | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');

  const load = async () => {
    const { data } = await supabase.from('campus_news').select('*').order('created_at', { ascending: false }).limit(50);
    setNews(data || []);
  };

  useEffect(() => { load(); }, []);

  const openNews = async (item: CampusNews) => {
    // 浏览量 +1
    await supabase.from('campus_news').update({ views: item.views + 1 }).eq('id', item.id);
    setSelected({ ...item, views: item.views + 1 });
  };

  const categories = ['全部', ...Array.from(new Set(news.map(n => n.category)))];
  const filtered = news.filter(n => {
    if (category !== '全部' && n.category !== category) return false;
    if (search && !n.title.includes(search)) return false;
    return true;
  });

  if (selected) return (
    <div>
      <Button variant="ghost" onClick={() => setSelected(null)} className="mb-4 text-[#165DFF]">← 返回列表</Button>
      <Card className="border-[#E5E6EB]">
        <CardContent className="p-6 space-y-4">
          <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0">{selected.category}</Badge>
          <h2 className="text-2xl font-bold text-gray-800 text-balance">{selected.title}</h2>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{new Date(selected.created_at).toLocaleDateString('zh-CN')}</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{selected.views} 次浏览</span>
          </div>
          <div className="border-t border-[#E5E6EB] pt-4">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="搜索资讯标题..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${category === c ? 'bg-[#165DFF] text-white' : 'bg-white border border-[#E5E6EB] text-gray-600'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <img src="https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_55511e80-ec4a-4776-bd3f-29dfa508f6fd.jpg"
            className="w-48 h-32 object-cover rounded-xl mx-auto mb-4 opacity-60" alt="校园资讯" />
          <p className="text-sm">暂无资讯</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} onClick={() => openNews(item)}
              className="bg-white border border-[#E5E6EB] rounded-xl p-4 flex items-start gap-4 cursor-pointer hover:border-[#165DFF]/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#165DFF]/10 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-[#165DFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-[#165DFF]/10 text-[#165DFF] border-0 text-xs">{item.category}</Badge>
                </div>
                <h3 className="font-semibold text-gray-800 mt-1 text-balance">{item.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
                  <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{item.views}</span>
                </div>
              </div>
              <span className="text-xs text-[#165DFF] shrink-0">阅读 →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────
export default function CampusLifePage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'classroom';

  // 登录提示弹窗状态
  const [loginPrompt, setLoginPrompt] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const requireLogin = (action: string) => setLoginPrompt({ open: true, action });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">校园生活</h1>
          <p className="text-sm text-gray-500 mt-1">空教室查询、社团活动、二手交易、失物招领、校园资讯一站搞定</p>
        </div>

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="bg-white border border-[#E5E6EB] p-1 h-auto flex-wrap gap-1">
            <TabsTrigger value="classroom" className="data-[state=active]:bg-[#165DFF] data-[state=active]:text-white gap-1.5">
              <DoorOpen className="w-4 h-4" /><span className="hidden sm:inline">空教室</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="data-[state=active]:bg-[#165DFF] data-[state=active]:text-white gap-1.5">
              <Users className="w-4 h-4" /><span className="hidden sm:inline">社团活动</span>
            </TabsTrigger>
            <TabsTrigger value="secondhand" className="data-[state=active]:bg-[#165DFF] data-[state=active]:text-white gap-1.5">
              <ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">二手交易</span>
            </TabsTrigger>
            <TabsTrigger value="lostfound" className="data-[state=active]:bg-[#165DFF] data-[state=active]:text-white gap-1.5">
              <Search className="w-4 h-4" /><span className="hidden sm:inline">失物招领</span>
            </TabsTrigger>
            <TabsTrigger value="news" className="data-[state=active]:bg-[#165DFF] data-[state=active]:text-white gap-1.5">
              <Megaphone className="w-4 h-4" /><span className="hidden sm:inline">校园资讯</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="classroom" className="mt-4"><ClassroomTab /></TabsContent>
          <TabsContent value="activities" className="mt-4"><ActivitiesTab onRequireLogin={requireLogin} /></TabsContent>
          <TabsContent value="secondhand" className="mt-4"><SecondHandTab onRequireLogin={requireLogin} /></TabsContent>
          <TabsContent value="lostfound" className="mt-4"><LostFoundTab onRequireLogin={requireLogin} /></TabsContent>
          <TabsContent value="news" className="mt-4"><NewsTab /></TabsContent>
        </Tabs>
      </div>

      {/* 登录提示弹窗 */}
      <LoginPromptModal
        open={loginPrompt.open}
        onClose={() => setLoginPrompt({ open: false, action: '' })}
        action={loginPrompt.action}
      />
    </Layout>
  );
}
