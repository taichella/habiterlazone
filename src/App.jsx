import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X, Crosshair, Radio, User, Mic, FileText, Lock, Unlock, LogOut, Edit, Trash2, Copy, Tag, ChevronRight } from 'lucide-react';
import { supabase } from './supabase';

const TRANSLATIONS = {
    fr: {
        subtitle: "Journal de terrain(s)", searchPlaceholder: "Rechercher...", clear: "Effacer", newSignal: "Nouveau Signal", editSignal: "Éditer", 
        idPlace: "Identifiant", notes: "Notes...", mediaUrl: "URL", dateTimeStr: "Date et Heure", save: "Enregistrer", context: "Tags", lat: "Lat", lng: "Lng",
        types: { text: "Texte", photo: "Photo", video: "Vidéo", audio: "Audio" }, selectHint: "Sélectionnez un ou plusieurs thèmes", timeline: "Chronologie",
        aboutProjectBtn: "À Propos", aboutAuthorBtn: "Misia Forlen", aboutTitle: "À Propos", authorTitle: "Misia Forlen",
        aboutProjectTitle: "Le Projet", aboutProjectDesc: "Recherche-création documentant les ZES.", aboutAuthorTitle: "L'Auteure",
        aboutAuthorDesc: "Architecte et doctorante RADIAN.", mapType: "Carte", mapStyleDark: "Sombre", mapStyleLight: "Clair", mapStyleSat: "Sat", directionView: "Vue",
        login: "Connexion", email: "E-mail", password: "Mot de passe", enter: "Entrer", edit: "Éditer", duplicate: "Dupliquer", delete: "Supprimer", deleteConfirm: "Sûr?",
        manageTags: "Gérer les Tags", newTag: "Nouveau Tag", editTag: "Éditer Tag", tagName: "Nom", tagColor: "Couleur", addTag: "Ajouter"
    },
    en: {
        subtitle: "Mapping System", searchPlaceholder: "Search...", clear: "Clear", newSignal: "New Signal", editSignal: "Edit", 
        idPlace: "ID", notes: "Notes...", mediaUrl: "URL", dateTimeStr: "Date & Time", save: "Save", context: "Tags", lat: "Lat", lng: "Lng",
        types: { text: "Text", photo: "Photo", video: "Video", audio: "Audio" }, selectHint: "Select one or more themes", timeline: "Timeline",
        aboutProjectBtn: "About", aboutAuthorBtn: "Misia Forlen", aboutTitle: "About", authorTitle: "Misia Forlen",
        aboutProjectTitle: "The Project", aboutProjectDesc: "Research-creation in SEZ.", aboutAuthorTitle: "The Author",
        aboutAuthorDesc: "Architect and PhD RADIAN.", mapType: "Map", mapStyleDark: "Dark", mapStyleLight: "Light", mapStyleSat: "Sat", directionView: "View",
        login: "Login", email: "Email", password: "Password", enter: "Enter", edit: "Edit", duplicate: "Duplicate", delete: "Delete", deleteConfirm: "Sure?",
        manageTags: "Manage Tags", newTag: "New Tag", editTag: "Edit Tag", tagName: "Name", tagColor: "Color", addTag: "Add"
    }
};

const formatDateTime = (datetimeStr, lang) => {
    if (!datetimeStr) return "";
    const d = new Date(datetimeStr);
    if (isNaN(d.getTime())) return datetimeStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return lang === 'fr' ? `${day}-${month}-${d.getFullYear()} à ${hours}:${minutes}` : `${d.getFullYear()}-${month}-${day} at ${hours}:${minutes}`;
};

const App = () => {
    const [lang, setLang] = useState('fr');
    const t = TRANSLATIONS[lang]; 
    const [memories, setMemories] = useState([]);
    const [dbTags, setDbTags] = useState([]); 
    const [selectedMemory, setSelectedMemory] = useState(null);
    const [aboutTab, setAboutTab] = useState(null);
    const [mapStyle, setMapStyle] = useState('dark');
    const [activeParentFilters, setActiveParentFilters] = useState([]); 
    const [activeSubFilters, setActiveSubFilters] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [session, setSession] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null); 
    const [newMemory, setNewMemory] = useState({ lat: "", lng: "", title: "", description: "", type: "text", tags: "", content: "", direction: 0, datetime: "" });
    const [fullScreenItem, setFullScreenItem] = useState(null);
    const [showTagManager, setShowTagManager] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#A621FF");
    const [newTagParentName, setNewTagParentName] = useState(""); 
    const [editingTagId, setEditingTagId] = useState(null);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const tileLayerRef = useRef(null);
    const markersRef = useRef({});
    const timelineRefs = useRef({});

    const currentHierarchy = useMemo(() => {
        const hierarchy = {};
        dbTags.filter(tg => !tg.parent_name).forEach(tag => {
            hierarchy[tag.name.toLowerCase()] = { color: tag.color || '#FFFFFF', children: [] };
        });
        dbTags.filter(tg => tg.parent_name).forEach(tag => {
            const pName = tag.parent_name.toLowerCase();
            if (hierarchy[pName]) hierarchy[pName].children.push(tag.name.toLowerCase());
        });
        return hierarchy;
    }, [dbTags]);

    const getDerivedTagColor = useCallback((tagName) => {
        const lowerTag = tagName.toLowerCase();
        if (currentHierarchy[lowerTag]) return currentHierarchy[lowerTag].color;
        for (const [, data] of Object.entries(currentHierarchy)) {
            if (data.children.includes(lowerTag)) return data.color;
        }
        const dbTag = dbTags.find(tag => tag.name.toLowerCase() === lowerTag);
        return dbTag ? dbTag.color : '#FFFFFF'; 
    }, [currentHierarchy, dbTags]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        supabase.auth.onAuthStateChange((_event, session) => setSession(session));
        const fetchData = async () => {
            const { data: mData } = await supabase.from('markers').select('*');
            if (mData) setMemories(mData);
            const { data: tData } = await supabase.from('tags').select('*');
            if (tData) setDbTags(tData);
        };
        fetchData();
    }, []);

    const filteredMemories = useMemo(() => {
        let result = memories;
        if (activeParentFilters.length > 0) {
            result = result.filter(m => {
                if (!m.tags) return false;
                const mTags = m.tags.map(tag => tag.toLowerCase());
                if (activeSubFilters.length > 0) return mTags.some(tag => activeSubFilters.includes(tag));
                let allAllowed = [];
                activeParentFilters.forEach(p => {
                    allAllowed.push(p);
                    if (currentHierarchy[p]) allAllowed.push(...currentHierarchy[p].children);
                });
                return mTags.some(tag => allAllowed.includes(tag));
            });
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m => m.title?.toLowerCase().includes(q) || m.tags?.some(t => t.toLowerCase().includes(q)));
        }
        return result;
    }, [memories, activeParentFilters, activeSubFilters, searchQuery, currentHierarchy]);

    const timelineMemories = useMemo(() => [...filteredMemories].sort((a, b) => new Date(b.date) - new Date(a.date)), [filteredMemories]);

    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([49.52, -1.80], 12);
            tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            map.on('click', (e) => {
                supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
                    if (currentSession) {
                        const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        setEditingId(null);
                        setNewMemory({ lat: e.latlng.lat, lng: e.latlng.lng, title: "", description: "", type: "text", tags: "", content: "", direction: 0, datetime: now.toISOString().slice(0, 16) });
                        setIsAdding(true); setSelectedMemory(null);
                    }
                });
            });
            mapInstanceRef.current = map;
        }
    }, [showTagManager]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        Object.values(markersRef.current).forEach(m => map.removeLayer(m));
        markersRef.current = {};
        filteredMemories.forEach(mem => {
            const coreColor = mapStyle === 'light' ? '#0A0A0A' : '#ffffff';
            let boxSh = mem.tags?.map((tag, i) => `0 0 0 ${(i + 1) * 2}px ${getDerivedTagColor(tag)}`).join(', ') || 'none';
            const iconHtml = `<div class="marker-container"><svg width="48" height="48" viewBox="0 0 48 48" style="position: absolute; transform: rotate(${mem.direction || 0}deg); overflow: visible;"><path d="M24,24 L6,4 A26,26 0 0,1 42,4 Z" fill="rgba(166, 33, 255, 0.6)" stroke="#D8B4FE" stroke-width="1.5" /></svg><div class="marker-core" style="box-shadow: ${boxSh}; background-color: ${coreColor};"></div></div>`;
            const marker = L.marker([mem.lat, mem.lng], { icon: L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: [48, 48], iconAnchor: [24, 24] }) })
                .addTo(map).on('click', (e) => { L.DomEvent.stopPropagation(e); setSelectedMemory(mem); });
            markersRef.current[mem.id] = marker;
        });
    }, [filteredMemories, getDerivedTagColor, mapStyle]);

    const handleLogin = async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert("Erro: " + error.message);
        else { setShowLogin(false); setEmail(''); setPassword(''); }
    };

    const handleSaveMemory = async () => {
        if (!newMemory.title || !newMemory.datetime) return;
        const memoryData = { 
            title: newMemory.title, lat: parseFloat(newMemory.lat), lng: parseFloat(newMemory.lng), 
            type: newMemory.type, content: newMemory.content, description: newMemory.description, 
            tags: newMemory.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), 
            date: newMemory.datetime, direction: newMemory.direction 
        };
        const { error } = editingId ? await supabase.from('markers').update(memoryData).eq('id', editingId) : await supabase.from('markers').insert([{...memoryData, id: Date.now()}]);
        if (!error) window.location.reload();
    };

    const handleSaveTag = async () => {
        if (!newTagName.trim()) return;
        const tagData = { name: newTagName.trim().toLowerCase(), color: newTagColor, parent_name: newTagParentName || null };
        const { error } = editingTagId ? await supabase.from('tags').update(tagData).eq('id', editingTagId) : await supabase.from('tags').insert([tagData]);
        if (!error) window.location.reload();
    };

    const deleteMemory = async (id) => {
        if (window.confirm(t.deleteConfirm)) {
            const { error } = await supabase.from('markers').delete().eq('id', id);
            if (!error) window.location.reload();
        }
    };

    return (
        <div className="relative w-full h-screen font-mono text-gray-200 bg-black">
            <div ref={mapRef} className="h-full w-full"></div>

            {/* PAINEL LATERAL ESQUERDO */}
            <div className="absolute top-0 left-0 w-full md:w-[380px] p-4 z-[1000] pointer-events-none flex flex-col gap-4">
                <div className="industrial-panel p-5 border-l-4 border-l-hlzPurple pointer-events-auto bg-black/90 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                        <h1 className="text-4xl font-bold tracking-tighter">Habiter la Zone</h1>
                        <div className="flex gap-2">
                            {session ? (
                                <button onClick={() => setShowTagManager(true)} className="text-hlzPurple"><Tag size={20}/></button>
                            ) : (
                                <button onClick={() => setShowLogin(true)} className="text-gray-600"><Lock size={16}/></button>
                            )}
                        </div>
                    </div>

                    <div className="relative mb-4">
                        <input type="text" placeholder={t.searchPlaceholder} className="w-full industrial-input p-2 pl-8 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <Search className="absolute left-2 top-2.5 text-gray-500" size={14} />
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {Object.keys(currentHierarchy).map(parent => (
                            <button key={parent} onClick={() => setActiveParentFilters(prev => prev.includes(parent) ? prev.filter(p => p !== parent) : [...prev, parent])}
                                className={`text-[10px] px-2 py-1 border transition-all ${activeParentFilters.includes(parent) ? 'bg-hlzPurple text-black' : 'border-gray-700'}`}
                                style={{ borderColor: currentHierarchy[parent].color }}>#{parent}</button>
                        ))}
                    </div>

                    {activeParentFilters.map(p => (
                        <div key={p} className="flex flex-wrap gap-1 mb-2 pl-2 border-l-2" style={{ borderColor: currentHierarchy[p].color }}>
                            {currentHierarchy[p].children.map(c => (
                                <button key={c} onClick={() => setActiveSubFilters(prev => prev.includes(c) ? prev.filter(s => s !== c) : [...prev, c])}
                                    className={`text-[9px] px-1 border ${activeSubFilters.includes(c) ? 'bg-white text-black' : 'border-gray-800 text-gray-500'}`}>{c}</button>
                            ))}
                        </div>
                    ))}
                    <div className="flex justify-between text-[10px] border-t border-gray-800 pt-4">
                        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="underline">LANGUAGE: {lang.toUpperCase()}</button>
                        <div className="flex gap-2">
                            <button onClick={() => setMapStyle('dark')} className={mapStyle === 'dark' ? 'text-white' : 'text-gray-600'}>DARK</button>
                            <button onClick={() => setMapStyle('light')} className={mapStyle === 'light' ? 'text-white' : 'text-gray-600'}>LIGHT</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* FORMULÁRIO DATA E HORA */}
            {isAdding && session && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[2000] w-11/12 max-w-md bg-black border border-hlzPurple p-6 shadow-2xl pointer-events-auto">
                    <div className="flex justify-between mb-4 border-b border-gray-800 pb-2">
                        <h2 className="text-xl font-bold uppercase">{t.newSignal}</h2>
                        <button onClick={() => setIsAdding(false)}><X/></button>
                    </div>
                    <div className="space-y-4">
                        <input type="text" placeholder={t.idPlace} className="w-full industrial-input p-3" value={newMemory.title} onChange={e => setNewMemory({...newMemory, title: e.target.value})} />
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-500 uppercase">{t.dateTimeStr}</label>
                            <input type="datetime-local" className="w-full industrial-input p-2 text-sm" value={newMemory.datetime} onChange={e => setNewMemory({...newMemory, datetime: e.target.value})} />
                        </div>
                        <div className="flex gap-2">
                            {['text', 'photo', 'video', 'audio'].map(tp => (
                                <button key={tp} onClick={() => setNewMemory({...newMemory, type: tp})} className={`flex-1 py-1 text-[10px] border ${newMemory.type === tp ? 'bg-hlzPurple text-black' : 'border-gray-700'}`}>{t.types[tp]}</button>
                            ))}
                        </div>
                        <textarea placeholder={t.notes} className="w-full industrial-input p-3 h-24" value={newMemory.description} onChange={e => setNewMemory({...newMemory, description: e.target.value})}></textarea>
                        <input type="text" placeholder={t.mediaUrl} className="w-full industrial-input p-2 text-xs" value={newMemory.content} onChange={e => setNewMemory({...newMemory, content: e.target.value})} />
                        <input type="text" placeholder="Tags (ex: art, performance)" className="w-full industrial-input p-2 text-xs" value={newMemory.tags} onChange={e => setNewMemory({...newMemory, tags: e.target.value})} />
                        <button onClick={handleSaveMemory} className="w-full bg-hlzPurple text-black font-bold py-3 uppercase">Sauvegarder le Point</button>
                    </div>
                </div>
            )}

            {/* TIMELINE DIREITA */}
            <div className="absolute top-0 right-0 w-[400px] h-full p-4 z-[900] pointer-events-none overflow-y-auto">
                <div className="pointer-events-auto flex flex-col gap-3">
                    {timelineMemories.map(mem => (
                        <div key={mem.id} ref={el => timelineRefs.current[mem.id] = el} onClick={() => setSelectedMemory(mem)} className={`p-4 bg-black/90 border transition-all ${selectedMemory?.id === mem.id ? 'border-hlzPurple' : 'border-gray-800'} cursor-pointer`}>
                            <h4 className="font-bold text-white text-sm">{mem.title}</h4>
                            <p className="text-[9px] text-gray-500 mb-2 uppercase tracking-widest">{formatDateTime(mem.date, lang)}</p>
                            {selectedMemory?.id === mem.id && (
                                <div className="mt-2 text-xs text-gray-400 space-y-3">
                                    {mem.type === 'photo' && mem.content && <img src={mem.content} onClick={() => setFullScreenItem({type: 'photo', src: mem.content})} className="w-full grayscale hover:grayscale-0 cursor-pointer" alt="terrain"/>}
                                    {mem.type === 'video' && mem.content && <div className="relative group cursor-pointer" onClick={() => setFullScreenItem({type: 'video', src: mem.content})}><video src={mem.content} className="w-full opacity-60" /><div className="absolute inset-0 flex items-center justify-center text-hlzPurple">▶</div></div>}
                                    <p className="leading-relaxed border-l border-hlzPurple pl-2">{mem.description}</p>
                                    {session && (
                                        <div className="flex gap-4 border-t border-gray-900 pt-3">
                                            <button onClick={() => deleteMemory(mem.id)} className="text-red-500 flex items-center gap-1"><Trash2 size={12}/> DELETE</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* MODAIS: LOGIN, TAGS E FULLSCREEN */}
            {showLogin && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <form onSubmit={handleLogin} className="industrial-panel p-6 w-full max-w-sm bg-black border border-hlzPurple">
                        <div className="flex justify-between mb-6 border-b border-gray-800 pb-2"><h2 className="text-xl font-bold uppercase"><Lock/> LOGIN</h2><button onClick={() => setShowLogin(false)}><X/></button></div>
                        <input type="email" placeholder="Email" className="w-full industrial-input p-3 mb-4" value={email} onChange={e => setEmail(e.target.value)} required />
                        <input type="password" placeholder="Password" className="w-full industrial-input p-3 mb-6" value={password} onChange={e => setPassword(e.target.value)} required />
                        <button type="submit" className="w-full bg-hlzPurple text-black font-bold py-3 uppercase">Entrer</button>
                    </form>
                </div>
            )}

            {showTagManager && session && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="industrial-panel p-6 w-full max-w-md bg-black border border-hlzPurple max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between mb-6 border-b border-gray-800 pb-2"><h2 className="text-xl font-bold uppercase"><Tag/> TAGS</h2><button onClick={() => setShowTagManager(false)}><X/></button></div>
                        <div className="space-y-2 mb-6">
                            {dbTags.map(tag => (
                                <div key={tag.id} className="flex justify-between p-2 border border-gray-800 bg-black/40">
                                    <span className="uppercase text-sm" style={{color: tag.color}}>#{tag.name} {tag.parent_name && <span className="text-[9px] text-gray-600">↳ {tag.parent_name}</span>}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => {setEditingTagId(tag.id); setNewTagName(tag.name); setNewTagColor(tag.color); setNewTagParentName(tag.parent_name || "");}}><Edit size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-gray-800 pt-4 space-y-3">
                            <input type="text" placeholder="Nom" className="w-full industrial-input p-2" value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                            <div className="flex gap-2">
                                <input type="color" className="h-8 w-12 bg-transparent" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} />
                                <select className="flex-1 industrial-input p-1 text-xs" value={newTagParentName} onChange={e => setNewTagParentName(e.target.value)}>
                                    <option value="">[ Categoria Principal ]</option>
                                    {Object.keys(currentHierarchy).map(p => <option key={p} value={p}>#{p}</option>)}
                                </select>
                            </div>
                            <button onClick={handleSaveTag} className="w-full bg-hlzPurple text-black font-bold py-2 uppercase text-xs">Sauvegarder Tag</button>
                        </div>
                    </div>
                </div>
            )}

            {fullScreenItem && (
                <div className="fixed inset-0 z-[4000] bg-black/95 flex items-center justify-center p-4" onClick={() => setFullScreenItem(null)}>
                    {fullScreenItem.type === 'photo' ? <img src={fullScreenItem.src} className="max-w-full max-h-full" /> : <video src={fullScreenItem.src} controls autoPlay className="max-w-full max-h-full" />}
                </div>
            )}
            
            <div className="fixed bottom-4 left-4 z-[2000] flex gap-2">
                <button onClick={() => setAboutTab('project')} className="text-[10px] bg-black/80 p-1 border border-gray-800">PROJECT</button>
                {session && <button onClick={() => supabase.auth.signOut()} className="text-[10px] text-red-500 bg-black/80 p-1 border border-gray-800">LOGOUT</button>}
            </div>
        </div>
    );
};

export default App;