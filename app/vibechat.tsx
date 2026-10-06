"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MessageCircle, CircleDot, Radio, Users, Settings, UserPlus, Search, MoreVertical,
  Send, LogOut, Phone, Video, Paperclip, Smile, CheckCheck, Image as ImageIcon,
  Plus, ArrowLeft, X, Bell, Lock, UserRound, Hash, Eye, Heart, Camera, Menu
} from "lucide-react";

type Profile = { id:string; username:string|null; display_name:string|null; avatar_url:string|null; bio:string|null; verified:boolean; last_seen?:string|null };
type Conversation = { id:string; type:"direct"|"group"|"channel"; title:string|null; avatar_url:string|null; created_at:string };
type Message = { id:string; conversation_id:string; sender_id:string; content:string; message_type:string; created_at:string; read_at:string|null };
type Status = { id:string; user_id:string; text:string|null; media_url:string|null; media_type:string|null; created_at:string; expires_at:string; profile?:Profile };
type Channel = { id:string; name:string; slug:string; description:string|null; avatar_url:string|null; owner_id:string; created_at:string };

const supabase = createClient();

export default function VibeChat({ userId }: { userId:string }) {
  const [me,setMe] = useState<Profile|null>(null);
  const [tab,setTab] = useState<"chats"|"status"|"channels"|"contacts"|"profile">("chats");
  const [profiles,setProfiles] = useState<Profile[]>([]);
  const [conversations,setConversations] = useState<Conversation[]>([]);
  const [selected,setSelected] = useState<Conversation|null>(null);
  const [messages,setMessages] = useState<Message[]>([]);
  const [message,setMessage] = useState("");
  const [typing,setTyping] = useState(false);
  const [otherTyping,setOtherTyping] = useState(false);
  const [search,setSearch] = useState("");
  const [showNew,setShowNew] = useState(false);
  const [showProfile,setShowProfile] = useState(false);
  const [notice,setNotice] = useState("");
  const [mobileList,setMobileList] = useState(true);

  const loadAll = async () => {
    const [{data:meData},{data:people}] = await Promise.all([
      supabase.from("profiles").select("*").eq("id",userId).maybeSingle(),
      supabase.from("profiles").select("*").neq("id",userId).order("created_at",{ascending:false}).limit(50)
    ]);
    if (meData) setMe(meData);
    setProfiles(people || []);
    await loadConversations();
  };

  const loadConversations = async () => {
    const {data:members} = await supabase.from("conversation_members").select("conversation_id").eq("user_id",userId);
    const ids = (members||[]).map(x=>x.conversation_id);
    if (!ids.length) { setConversations([]); return; }
    const {data} = await supabase.from("conversations").select("*").in("id",ids).order("created_at",{ascending:false});
    setConversations((data||[]) as Conversation[]);
  };

  useEffect(()=>{ loadAll(); },[]);

  useEffect(()=>{
    if (!selected) { setMessages([]); return; }
    loadMessages(selected.id);
    const channel = supabase.channel(`messages:${selected.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${selected.id}`},payload=>{
        const m=payload.new as Message;
        setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m]);
      })
      .on("presence",{event:"sync"},()=> {
        const state=channel.presenceState();
        const values=Object.values(state).flat() as {user_id?:string;typing?:boolean}[];
        setOtherTyping(values.some(x=>x.user_id!==userId && x.typing));
      })
      .subscribe(async status=>{
        if(status==="SUBSCRIBED") await channel.track({user_id:userId,typing:false});
      });
    return ()=>{ supabase.removeChannel(channel); };
  },[selected?.id]);

  async function loadMessages(id:string) {
    const {data} = await supabase.from("messages").select("*").eq("conversation_id",id).order("created_at",{ascending:true}).limit(200);
    setMessages(data||[]);
    await supabase.from("messages").update({read_at:new Date().toISOString()}).eq("conversation_id",id).neq("sender_id",userId).is("read_at",null);
  }

  async function openDirect(profile:Profile) {
    const {data,error} = await supabase.rpc("get_or_create_direct_conversation",{other_user_id:profile.id});
    if(error) return setNotice(error.message);
    await loadConversations();
    const {data:conv} = await supabase.from("conversations").select("*").eq("id",data).single();
    if(conv) { setSelected(conv); setTab("chats"); setMobileList(false); }
    setShowNew(false);
  }

  async function sendMessage() {
    const body=message.trim();
    if(!body || !selected) return;
    setMessage("");
    const {error}=await supabase.from("messages").insert({conversation_id:selected.id,sender_id:userId,content:body,message_type:"text"});
    if(error) setNotice(error.message);
  }

  async function signOut() { await supabase.auth.signOut(); location.href="/auth"; }

  const selectedPeople = useMemo(()=>profiles.filter(p=>(p.display_name||p.username||"").toLowerCase().includes(search.toLowerCase())),[profiles,search]);

  return (
    <main className="h-screen overflow-hidden bg-[#07110f] p-0 md:p-3">
      <div className="mx-auto flex h-full max-w-[1550px] overflow-hidden rounded-none border border-white/10 bg-[#0b1513] shadow-2xl md:rounded-[28px]">
        <aside className={`${mobileList?"flex":"hidden"} w-full shrink-0 flex-col border-r border-white/10 bg-[#0d1816] md:flex md:w-[390px]`}>
          <header className="flex items-center justify-between p-5">
            <div><div className="text-xl font-black">VibeChat</div><div className="text-xs text-white/35">stay connected.</div></div>
            <div className="flex gap-1"><button onClick={()=>setShowNew(true)} className="rounded-xl p-2 hover:bg-white/5"><UserPlus size={19}/></button><button className="rounded-xl p-2 hover:bg-white/5"><MoreVertical size={19}/></button></div>
          </header>

          <nav className="grid grid-cols-5 gap-1 px-3 pb-3">
            {[
              ["chats",MessageCircle,"Chat"],["status",CircleDot,"Status"],["channels",Radio,"Channel"],["contacts",Users,"Kontak"],["profile",UserRound,"Profil"]
            ].map(([id,Icon,label])=><button key={id as string} onClick={()=>setTab(id as any)} className={`rounded-2xl p-2 text-[11px] ${tab===id?"bg-emerald-400/15 text-emerald-300":"text-white/45 hover:bg-white/5"}`}><Icon size={17} className="mx-auto mb-1"/>{label as string}</button>)}
          </nav>

          <div className="px-4 pb-3"><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5"><Search size={17} className="text-white/35"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari..." className="w-full bg-transparent text-sm outline-none"/></div></div>

          <div className="flex-1 overflow-auto px-2">
            {tab==="chats" && <ChatList conversations={conversations} selected={selected} onSelect={(c)=>{setSelected(c);setMobileList(false)}} userId={userId} />}
            {tab==="status" && <StatusPanel userId={userId} profiles={profiles} me={me}/>}
            {tab==="channels" && <ChannelPanel userId={userId}/>}
            {tab==="contacts" && <div className="p-2">{selectedPeople.map(p=><button key={p.id} onClick={()=>openDirect(p)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/5"><Avatar p={p}/><div className="min-w-0"><div className="font-semibold">{p.display_name||p.username||"User"} <Verified show={p.verified}/></div><div className="text-xs text-white/35">@{p.username||"username"}</div></div></button>)}{!selectedPeople.length&&<Empty title="Kontak kosong" desc="Cari user berdasarkan username atau nama."/>}</div>}
            {tab==="profile" && me && <ProfilePanel me={me} onEdit={()=>setShowProfile(true)} onLogout={signOut}/>}
          </div>
          <div className="border-t border-white/10 p-3 text-center text-[11px] text-white/25">VibeChat • realtime</div>
        </aside>

        <section className={`${mobileList?"hidden":"flex"} min-w-0 flex-1 flex-col md:flex`}>
          {selected ? <ChatWindow selected={selected} messages={messages} userId={userId} message={message} setMessage={setMessage} send={sendMessage} otherTyping={otherTyping} back={()=>setMobileList(true)}/> : <Empty title="Selamat datang di VibeChat" desc="Pilih chat atau tambahkan kontak untuk mulai ngobrol."/>}
        </section>
      </div>

      {showNew && <Modal title="Mulai chat" onClose={()=>setShowNew(false)}><div className="space-y-2">{profiles.map(p=><button key={p.id} onClick={()=>openDirect(p)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/5"><Avatar p={p}/><div><div className="font-semibold">{p.display_name||p.username} <Verified show={p.verified}/></div><div className="text-xs text-white/40">{p.username?`@${p.username}`:"Belum punya username"}</div></div></button>)}</div></Modal>}
      {showProfile && me && <EditProfile me={me} onClose={()=>setShowProfile(false)} onSaved={(p)=>{setMe(p);setShowProfile(false)}}/>}
      {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#16231f] px-4 py-3 text-sm shadow-2xl">{notice}<button onClick={()=>setNotice("")} className="ml-4 text-white/40">×</button></div>}
    </main>
  );
}

function ChatList({conversations,selected,onSelect,userId}:{conversations:Conversation[];selected:Conversation|null;onSelect:(c:Conversation)=>void;userId:string}) {
  if(!conversations.length) return <Empty title="Belum ada chat" desc="Tekan tombol + untuk memulai percakapan." />;
  return <>{conversations.map(c=><button key={c.id} onClick={()=>onSelect(c)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${selected?.id===c.id?"bg-white/[.06]":"hover:bg-white/[.035]"}`}><div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-400 font-bold text-black">{c.type==="group"?"G":"V"}</div><div className="min-w-0 flex-1"><div className="font-semibold">{c.title||"Percakapan"}</div><div className="truncate text-xs text-white/35">{c.type==="channel"?"Channel":"Tap untuk membuka chat"}</div></div><span className="text-[10px] text-white/25">Vibe</span></button>)}</>;
}

function ChatWindow({selected,messages,userId,message,setMessage,send,otherTyping,back}:{selected:Conversation;messages:Message[];userId:string;message:string;setMessage:(x:string)=>void;send:()=>void;otherTyping:boolean;back:()=>void}) {
  const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{end.current?.scrollIntoView({behavior:"smooth"})},[messages.length]);
  return <>
    <header className="flex items-center gap-3 border-b border-white/10 p-4">
      <button onClick={back} className="rounded-xl p-2 md:hidden"><ArrowLeft size={19}/></button>
      <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-400 font-bold text-black">{(selected.title||"V")[0]}</div>
      <div className="min-w-0 flex-1"><div className="font-semibold">{selected.title||"VibeChat"}</div><div className="text-xs text-emerald-300/60">{otherTyping?"mengetik...":"online"}</div></div>
      <Phone size={18} className="text-white/45"/><Video size={19} className="text-white/45"/><MoreVertical size={19} className="text-white/45"/>
    </header>
    <div className="flex-1 overflow-auto p-4 md:p-7">
      {messages.length===0&&<div className="grid h-full place-items-center"><div className="text-center"><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/5"><Lock size={22}/></div><p className="font-semibold">Percakapan baru</p><p className="text-sm text-white/35">Pesan tersimpan aman di Supabase.</p></div></div>}
      {messages.map(m=><div key={m.id} className={`mb-2 flex ${m.sender_id===userId?"justify-end":"justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_id===userId?"rounded-br-md bg-emerald-400 text-black":"rounded-bl-md bg-white/[.07]"}`}>{m.content}<div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-55">{new Date(m.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}{m.sender_id===userId&&<CheckCheck size={14}/>}</div></div></div>)}
      <div ref={end}/>
    </div>
    <form onSubmit={e=>{e.preventDefault();send()}} className="flex items-center gap-2 border-t border-white/10 p-3 md:p-4">
      <button type="button" className="rounded-xl p-2 text-white/45"><Paperclip size={20}/></button>
      <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-emerald-400"/>
      <button type="button" className="rounded-xl p-2 text-white/45"><Smile size={20}/></button>
      <button className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 text-black"><Send size={18}/></button>
    </form>
  </>;
}

function StatusPanel({userId,profiles,me}:{userId:string;profiles:Profile[];me:Profile|null}) {
  const [statuses,setStatuses]=useState<Status[]>([]);
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  async function load(){const {data}=await supabase.from("statuses").select("*").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false});setStatuses(data||[])}
  useEffect(()=>{load()},[]);
  async function post(){if(!text.trim())return;setBusy(true);const {error}=await supabase.from("statuses").insert({user_id:userId,text:text.trim()});setBusy(false);if(!error){setText("");load()}}
  const map=new Map(profiles.map(p=>[p.id,p]));
  if(me)map.set(me.id,me);
  return <div className="p-2">
    <div className="rounded-2xl bg-white/[.04] p-4">
      <div className="mb-3 flex items-center gap-3"><Avatar p={me||{id:userId,username:"",display_name:"Kamu",avatar_url:null,bio:null,verified:false}}/><div><b>Status kamu</b><div className="text-xs text-white/35">Bagikan update selama 24 jam</div></div></div>
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Tulis status..." className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"/>
      <button disabled={!text.trim()||busy} onClick={post} className="mt-2 w-full rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-black disabled:opacity-40">{busy?"Mengirim...":"Bagikan status"}</button>
    </div>
    <div className="mt-3 space-y-2">{statuses.map(s=>{const p=map.get(s.user_id);return <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[.025] p-3"><div className="flex items-center gap-3"><Avatar p={p||{id:s.user_id,username:null,display_name:"User",avatar_url:null,bio:null,verified:false}}/><div><b>{p?.display_name||p?.username||"User"} <Verified show={!!p?.verified}/></b><div className="text-[11px] text-white/30">{new Date(s.created_at).toLocaleString("id-ID")}</div></div></div>{s.text&&<p className="mt-3 text-sm text-white/75">{s.text}</p>}{s.media_url&&<img src={s.media_url} className="mt-3 max-h-80 w-full rounded-xl object-cover"/>}<div className="mt-2 flex items-center gap-2 text-xs text-white/30"><Eye size={14}/> status aktif 24 jam</div></div>})}</div>
  </div>
}

function ChannelPanel({userId}:{userId:string}) {
  const [channels,setChannels]=useState<Channel[]>([]);
  const [name,setName]=useState("");
  const [desc,setDesc]=useState("");
  const [show,setShow]=useState(false);
  const [selected,setSelected]=useState<Channel|null>(null);
  const [post,setPost]=useState("");
  const [posts,setPosts]=useState<any[]>([]);
  async function load(){const {data}=await supabase.from("channels").select("*").order("created_at",{ascending:false});setChannels(data||[])}
  useEffect(()=>{load()},[]);
  async function create(){if(!name.trim())return;const slug=name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");const {data,error}=await supabase.from("channels").insert({name:name.trim(),slug,description:desc,owner_id:userId}).select().single();if(!error&&data){await supabase.from("channel_members").insert({channel_id:data.id,user_id:userId});setName("");setDesc("");setShow(false);load()}}
  async function open(c:Channel){setSelected(c);const {data}=await supabase.from("channel_posts").select("*").eq("channel_id",c.id).order("created_at",{ascending:false});setPosts(data||[]);await supabase.from("channel_members").upsert({channel_id:c.id,user_id:userId})}
  async function sendPost(){if(!post.trim()||!selected)return;const {data}=await supabase.from("channel_posts").insert({channel_id:selected.id,author_id:userId,content:post.trim()}).select().single();if(data)setPosts(x=>[data,...x]);setPost("")}
  if(selected)return <div className="p-2"><button onClick={()=>setSelected(null)} className="mb-2 flex items-center gap-2 rounded-xl p-2 text-sm text-white/55"><ArrowLeft size={17}/> Semua channel</button><div className="rounded-2xl bg-white/[.04] p-4"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20 text-blue-300"><Hash/></div><div><b>{selected.name}</b><p className="text-xs text-white/35">{selected.description||"Channel VibeChat"}</p></div></div></div><div className="my-3 space-y-2">{posts.map(p=><div key={p.id} className="rounded-2xl bg-white/[.035] p-3"><div className="text-xs text-white/30">{new Date(p.created_at).toLocaleString("id-ID")}</div><p className="mt-2 text-sm">{p.content}</p><div className="mt-3 flex gap-2 text-xs text-white/35"><Heart size={14}/> {p.reactions||0}</div></div>)}</div><div className="flex gap-2"><input value={post} onChange={e=>setPost(e.target.value)} placeholder="Tulis postingan..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none"/><button onClick={sendPost} className="rounded-xl bg-emerald-400 px-4 text-black"><Send size={17}/></button></div></div>;
  return <div className="p-2"><button onClick={()=>setShow(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-black"><Plus size={17}/> Buat channel</button>{channels.map(c=><button key={c.id} onClick={()=>open(c)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/5"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/15 text-blue-300"><Radio size={19}/></div><div><b>{c.name}</b><div className="text-xs text-white/35">{c.description||"Channel VibeChat"}</div></div></button>)}{!channels.length&&<Empty title="Belum ada channel" desc="Buat channel pertama kamu."/>}{show&&<Modal title="Buat channel" onClose={()=>setShow(false)}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama channel" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none"/><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Deskripsi" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none"/><button onClick={create} className="mt-3 w-full rounded-xl bg-emerald-400 py-3 font-bold text-black">Buat</button></Modal>}</div>
}

function ProfilePanel({me,onEdit,onLogout}:{me:Profile;onEdit:()=>void;onLogout:()=>void}) { return <div className="p-4"><div className="rounded-3xl bg-white/[.04] p-5 text-center"><Avatar p={me} large/><h2 className="mt-4 text-xl font-black">{me.display_name||"Vibe User"} <Verified show={me.verified}/></h2><p className="text-sm text-white/35">@{me.username||"username"}</p><p className="mt-3 text-sm text-white/55">{me.bio||"Belum ada bio."}</p><button onClick={onEdit} className="mt-5 w-full rounded-2xl bg-white/7 py-3 text-sm font-semibold">Edit profil</button></div><button className="mt-3 flex w-full items-center gap-3 rounded-2xl p-3 text-sm hover:bg-white/5"><Settings size={18}/> Pengaturan</button><button onClick={onLogout} className="flex w-full items-center gap-3 rounded-2xl p-3 text-sm text-red-300 hover:bg-red-500/5"><LogOut size={18}/> Keluar</button></div> }

function EditProfile({me,onClose,onSaved}:{me:Profile;onClose:()=>void;onSaved:(p:Profile)=>void}) {
  const [name,setName]=useState(me.display_name||""); const [username,setUsername]=useState(me.username||""); const [bio,setBio]=useState(me.bio||""); const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  async function save(){setBusy(true);setErr("");const {data,error}=await supabase.from("profiles").update({display_name:name,username:username||null,bio}).eq("id",me.id).select().single();setBusy(false);if(error)return setErr(error.message);onSaved(data)}
  return <Modal title="Edit profil" onClose={onClose}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none"/><input value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,"").toLowerCase())} placeholder="username" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none"/><textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Bio" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none"/>{err&&<p className="mt-2 text-sm text-red-300">{err}</p>}<button disabled={busy} onClick={save} className="mt-3 w-full rounded-xl bg-emerald-400 py-3 font-bold text-black">{busy?"Menyimpan...":"Simpan"}</button></Modal>
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) { return <div className="fixed inset-0 z-40 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101b18] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="rounded-xl p-2 hover:bg-white/5"><X size={18}/></button></div>{children}</div></div> }
function Verified({show}:{show:boolean}) { return show?<img src="/verified-badge.png" alt="Verified" className="ml-1 inline-block h-4 w-4 align-[-2px] object-contain"/>:null }
function Avatar({p,large=false}:{p:Profile;large?:boolean}) { const fallback=(p.display_name||p.username||"U")[0].toUpperCase(); return p.avatar_url?<img src={p.avatar_url} alt="" className={`${large?"h-24 w-24":"h-11 w-11"} rounded-full object-cover`}/>:<div className={`${large?"h-24 w-24 text-3xl":"h-11 w-11"} grid place-items-center rounded-full bg-emerald-400 font-bold text-black`}>{fallback}</div> }
function Empty({title,desc}:{title:string;desc:string}) { return <div className="grid min-h-48 place-items-center p-8 text-center"><div><div className="text-lg font-bold">{title}</div><p className="mt-2 text-sm text-white/35">{desc}</p></div></div> }
