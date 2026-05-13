import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X, Crosshair, Radio, User, Mic, FileText, Lock, Unlock, LogOut, Edit, Trash2, Copy, Tag, ChevronRight } from 'lucide-react';
import { supabase } from './supabase';

const PALETTE = { purple: '#A621FF', neutralBg: '#0A0A0A' };

const TRANSLATIONS = {
    fr: {
        subtitle: "Journal de terrain(s)", searchPlaceholder: "Rechercher...", clear: "Effacer", newSignal: "Nouveau Signal", editSignal: "Éditer", 
        idPlace: "Identifiant", notes: "Notes...", mediaUrl: "URL", dateTimeStr: "Date et Heure", save: "Enregistrer", context: "Tags", lat: "Lat", lng: "Lng",
        types: { text: "Texte", photo: "Photo", video: "Vidéo", audio: "Audio" }, selectHint: "Sélectionnez un thème", timeline: "Chronologie",
        aboutProjectBtn: "À Propos", aboutAuthorBtn: "Misia Forlen", aboutTitle: "À Propos", authorTitle: "Misia Forlen",
        aboutProjectTitle: "Le Projet", aboutProjectDesc: "Recherche-création documentant les ZES.", aboutAuthorTitle: "L'Auteure",
        aboutAuthorDesc: "Architecte et doctorante RADIAN.", mapType: "Carte", mapStyleDark: "Sombre", mapStyleLight: "Clair", mapStyleSat: "Sat", directionView: "Angle de Vue",
        login: "Connexion", email: "E-mail", password: "Mot de passe", enter: "Entrer", edit: "Éditer", duplicate: "Dupliquer", delete: "Supprimer", deleteConfirm: "Sûr?",
        manageTags: "Gérer les Tags", newTag: "Nouveau Tag", editTag: "Éditer Tag", tagName: "Nom", tagColor: "Couleur", addTag: "Ajouter"
    },
    en: {
        subtitle: "Mapping System", searchPlaceholder: "Search...", clear: "Clear", newSignal: "New Signal", editSignal: "Edit", 
        idPlace: "ID", notes: "Notes...", mediaUrl: "URL", dateTimeStr: "Date & Time", save: "Save", context: "Tags", lat: "Lat", lng: "Lng",
        types: { text: "Text", photo: "Photo", video: "Video", audio: "Audio" }, selectHint: "Select a theme", timeline: "Timeline",
        aboutProjectBtn: "About", aboutAuthorBtn: "Misia Forlen", aboutTitle: "About", authorTitle: "Misia Forlen",
        aboutProjectTitle: "The Project", aboutProjectDesc: "Research-creation in SEZ.", aboutAuthorTitle: "The Author",
        aboutAuthorDesc: "Architect and PhD RADIAN.", mapType: "Map", mapStyleDark: "Dark", mapStyleLight: "Light", mapStyleSat: "Sat", directionView: "View Direction",
        login: "Login", email: "Email", password: "Password", enter: "Enter", edit: "Edit", duplicate: "Duplicate", delete: "Delete", deleteConfirm: "Sure?",
        manageTags: "Manage Tags", newTag: "New Tag", editTag: "Edit Tag", tagName: "Name", tagColor: "Color", addTag: "Add"
    }
};

const formatDateTime = (datetimeStr, lang) => {
    if (!datetimeStr) return "";
    const d = new Date(datetimeStr);
    if (isNaN(d.getTime())) return datetimeStr;
    if (lang === 'fr') return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} à ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    let h = d.getHours(), ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} at ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
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
    const linesRef = useRef([]);
    const timelineRefs = useRef({});

    const currentHierarchy = useMemo(() => {
        const hierarchy = {};
        dbTags.filter(t => !t.parent_name).forEach(tag => {
            hierarchy[tag.name.toLowerCase()] = { color: tag.color || '#FFFFFF', children: [] };
        });
        dbTags.filter(t => t.parent_name).forEach(tag => {
            const pName = tag.parent_name.toLowerCase();
            if (hierarchy[pName] && !hierarchy[pName].children.includes(tag.name.toLowerCase())) {
                hierarchy[pName].children.push(tag.name.toLowerCase());
            }
        });
        return hierarchy;
    }, [dbTags]);

    const allParentOptions = useMemo(() => {
        return Object.keys(currentHierarchy).sort();
    }, [currentHierarchy]);

    const getDerivedTagColor = useCallback((tagName) => {
        const lowerTag = tagName.toLowerCase();
        if (currentHierarchy[lowerTag]) return currentHierarchy[lowerTag].color;
        for (const [, data] of Object.entries(currentHierarchy)) {
            if (data.children.includes(lowerTag)) return data.color;
        }
        const dbTag = dbTags.find(t => t.name.toLowerCase() === lowerTag);
        return dbTag ? dbTag.color : '#FFFFFF'; 
    }, [currentHierarchy, dbTags]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            const { data: mData } = await supabase.from('markers').select('*');
            if (mData) setMemories(mData);
            const { data: tData } = await supabase.from('tags').select('*');
            if (tData) setDbTags(tData);
        };
        fetchData();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert("Erro: " + error.message);
        else { setShowLogin(false); setEmail(''); setPassword(''); }
    };
    const handleLogout = async () => await supabase.auth.signOut();

    useEffect(() => {
        if (selectedMemory && timelineRefs.current[selectedMemory.id]) {
            timelineRefs.current[selectedMemory.id].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selectedMemory]);

    const filteredMemories = useMemo(() => {
        let result = memories;
        if (activeParentFilters.length > 0) {
            if (activeSubFilters.length > 0) {
                result = result.filter(m => m.tags && m.tags.some(tag => activeSubFilters.includes(tag.toLowerCase())));
            } else {
                let validTags = [];
                activeParentFilters.forEach(parent => {
                    validTags.push(parent);
                    if (currentHierarchy[parent]) validTags.push(...currentHierarchy[parent].children);
                });
                result = result.filter(m => m.tags && m.tags.some(tag => validTags.includes(tag.toLowerCase())));
            }
        }
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase();
            result = result.filter(m => (m.title && m.title.toLowerCase().includes(query)) || (m.description && m.description.toLowerCase().includes(query)) || (m.tags && m.tags.some(t => t.toLowerCase().includes(query))));
        }
        return result;
    }, [memories, activeParentFilters, activeSubFilters, searchQuery, currentHierarchy]);

    const timelineMemories = useMemo(() => [...filteredMemories].sort((a, b) => new Date(b.date) - new Date(a.date)), [filteredMemories]);

    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([49.52, -1.80], 12);
            tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20 }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            setTimeout(() => map.invalidateSize(), 250);

            map.on('click', (e) => {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session && !showTagManager) { 
                        const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        setEditingId(null); 
                        setNewMemory({ lat: e.latlng.lat, lng: e.latlng.lng, title: "", description: "", type: "text", tags: "", content: "", direction: 0, datetime: now.toISOString().slice(0, 16) });
                        setIsAdding(true); setSelectedMemory(null); setAboutTab(null);
                    }
                });
            });
            mapInstanceRef.current = map;
        }
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }, [showTagManager]);

    useEffect(() => {
        if (!mapInstanceRef.current || !tileLayerRef.current) return;
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
        let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        if (mapStyle === 'light') url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        else if (mapStyle === 'satellite') url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        tileLayerRef.current = L.tileLayer(url, { subdomains: 'abcd', maxZoom: 20 }).addTo(mapInstanceRef.current);
    }, [mapStyle]);

    const handleSelectMemory = (mem) => {
        setSelectedMemory(mem); setAboutTab(null); setIsAdding(false);
        if (mapInstanceRef.current) mapInstanceRef.current.setView([mem.lat, mem.lng], mapInstanceRef.current.getZoom(), { animate: true, duration: 1.2 });
    };

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        Object.values(markersRef.current).forEach(m => map.removeLayer(m));
        linesRef.current.forEach(l => map.removeLayer(l));
        markersRef.current = {}; linesRef.current = [];

        filteredMemories.forEach(mem => {
            const coreColor = mapStyle === 'light' ? '#0A0A0A' : '#ffffff';
            const coneColor = mapStyle === 'light' ? 'rgba(166, 33, 255, 0.4)' : 'rgba(166, 33, 255, 0.65)';
            const strokeColor = mapStyle === 'light' ? '#7C3AED' : '#D8B4FE';
            let boxSh = 'none';
            if (mem.tags && mem.tags.length > 0) boxSh = mem.tags.map((tag, i) => `0 0 0 ${(i + 1) * 2}px ${getDerivedTagColor(tag)}`).join(', ');

            const iconHtml = `<div class="marker-container"><svg width="48" height="48" viewBox="0 0 48 48" style="position: absolute; top: 0; left: 0; transform: rotate(${mem.direction || 0}deg); transform-origin: center; pointer-events: none; overflow: visible;"><path d="M24,24 L6,4 A26,26 0 0,1 42,4 Z" fill="${coneColor}" stroke="${strokeColor}" stroke-width="1.5" /></svg><div class="marker-core" style="box-shadow: ${boxSh}; background-color: ${coreColor};"></div></div>`;
            const icon = L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: [48, 48], iconAnchor: [24, 24] });
            const marker = L.marker([mem.lat, mem.lng], { icon }).addTo(map).on('click', (e) => { L.DomEvent.stopPropagation(e); handleSelectMemory(mem); });
            markersRef.current[mem.id] = marker;
        });

        if (filteredMemories.length > 1 && (activeParentFilters.length > 0 || searchQuery)) {
            for (let i = 0; i < filteredMemories.length; i++) {
                for (let j = i + 1; j < filteredMemories.length; j++) {
                    const polyline = L.polyline([[filteredMemories[i].lat, filteredMemories[i].lng], [filteredMemories[j].lat, filteredMemories[j].lng]], { color: PALETTE.purple, weight: 2, opacity: 0.6, dashArray: '5, 5' }).addTo(map);
                    linesRef.current.push(polyline);
                }
            }
        }
    }, [filteredMemories, selectedMemory, activeParentFilters, searchQuery, mapStyle, dbTags, currentHierarchy, getDerivedTagColor]); 

    const closeModal = () => { setIsAdding(false); setEditingId(null); setNewMemory({ lat: "", lng: "", title: "", description: "", type: "text", tags: "", content: "", direction: 0, datetime: "" }); };

    const handleDeleteMemory = async (id, e) => {
        e.stopPropagation(); 
        if (window.confirm(t.deleteConfirm)) {
            const { error } = await supabase.from('markers').delete().eq('id', id);
            if (!error) { setMemories(memories.filter(m => m.id !== id)); if (selectedMemory?.id === id) setSelectedMemory(null); }
        }
    };

    const handleEditClick = (mem, e) => { 
        e.stopPropagation(); 
        const formattedDate = mem.date ? new Date(mem.date).toISOString().slice(0, 16) : "";
        setNewMemory({ ...mem, datetime: formattedDate, tags: mem.tags ? mem.tags.join(', ') : "" }); 
        setEditingId(mem.id); 
        setIsAdding(true); 
    };
    const handleDuplicateClick = (mem, e) => { 
        e.stopPropagation(); 
        const formattedDate = mem.date ? new Date(mem.date).toISOString().slice(0, 16) : "";
        setNewMemory({ ...mem, title: mem.title + " (Copie)", datetime: formattedDate, tags: mem.tags ? mem.tags.join(', ') : "", lat: mem.lat + 0.005, lng: mem.lng + 0.005 }); 
        setEditingId(null); 
        setIsAdding(true); 
    };

    const handleSaveMemory = async () => {
        if (!newMemory.title || newMemory.lat === "" || newMemory.lng === "" || !newMemory.datetime) return;
        const memoryData = { title: newMemory.title, lat: parseFloat(newMemory.lat), lng: parseFloat(newMemory.lng), type: newMemory.type, content: newMemory.content, description: newMemory.description, tags: newMemory.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean), date: newMemory.datetime, direction: newMemory.direction };
        if (editingId) {
            const { error } = await supabase.from('markers').update(memoryData).eq('id', editingId);
            if (!error) { setMemories(memories.map(m => m.id === editingId ? { ...memoryData, id: editingId } : m)); closeModal(); }
        } else {
            const memoryToSave = { ...memoryData, id: Date.now() };
            const { error } = await supabase.from('markers').insert([memoryToSave]);
            if (!error) { setMemories([...memories, memoryToSave]); closeModal(); }
        }
    };

    const handleEditTagClick = (tag) => { setEditingTagId(tag.id); setNewTagName(tag.name); setNewTagColor(tag.color); setNewTagParentName(tag.parent_name || ""); };
    const handleCancelTagEdit = () => { setEditingTagId(null); setNewTagName(""); setNewTagColor("#A621FF"); setNewTagParentName(""); };

    const handleSaveTag = async () => {
        if (!newTagName.trim()) return;
        const tagData = { 
            name: newTagName.trim().toLowerCase(), 
            color: newTagColor, 
            parent_name: newTagParentName === "" ? null : newTagParentName.toLowerCase() 
        };
        if (editingTagId) {
            const { error } = await supabase.from('tags').update(tagData).eq('id', editingTagId);
            if (!error) { setDbTags(dbTags.map(t => t.id === editingTagId ? { ...t, ...tagData } : t)); handleCancelTagEdit(); }
        } else {
            const { data, error } = await supabase.from('tags').insert([tagData]).select();
            if (!error) { setDbTags([...dbTags, data[0]]); setNewTagName(""); setNewTagParentName(""); }
        }
    };

    const handleDeleteTag = async (id) => {
        if (window.confirm(t.deleteConfirm)) {
            const { error } = await supabase.from('tags').delete().eq('id', id);
            if (!error) setDbTags(dbTags.filter(tag => tag.id !== id));
        }
    };

    const toggleParentFilter = (parentTag) => {
        setActiveParentFilters(prev => {
            if (prev.includes(parentTag)) {
                const childrenToRemove = currentHierarchy[parentTag]?.children || [];
                setActiveSubFilters(subs => subs.filter(s => !childrenToRemove.includes(s)));
                return prev.filter(t => t !== parentTag);
            } else {
                return [...prev, parentTag];
            }
        });
    };
    const toggleSubFilter = (childTag) => setActiveSubFilters(prev => prev.includes(childTag) ? prev.filter(t => t !== childTag) : [...prev, childTag]);

    return (
        <div className="relative w-full h-screen font-mono text-gray-200">
            <div ref={mapRef} id="map" className="h-full w-full"></div>

            <div className="absolute top-0 left-0 w-full md:w-[380px] p-4 z-[1000] pointer-events-none flex flex-col gap-4">
                <div className="industrial-panel p-5 border-l-4 border-l-hlzPurple pointer-events-auto shrink-0 flex flex-col max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-2 items-center">
                            <button onClick={() => {setAboutTab('project'); closeModal(); setSelectedMemory(null);}} className="text-[10px] text-gray-400 hover:text-white underline">{t.aboutProjectBtn}</button>
                            <span className="text-[10px] text-gray-700">|</span>
                            <button onClick={() => {setAboutTab('author'); closeModal(); setSelectedMemory(null);}} className="text-[10px] text-gray-400 hover:text-white underline">{t.aboutAuthorBtn}</button>
                        </div>
                        <div className="flex gap-2 items-center">
                            {session ? (
                                <><button onClick={() => setShowTagManager(true)} className="text-gray-400 hover:text-hlzPurple" title={t.manageTags}><Tag size={14} /></button><button onClick={handleLogout} className="text-hlzPurple hover:text-white" title="Logout"><LogOut size={14} /></button></>
                            ) : (<button onClick={() => setShowLogin(true)} className="text-gray-600 hover:text-hlzPurple" title="Login Admin"><Lock size={14} /></button>)}
                            <span className="text-[10px] text-gray-700">|</span>
                            <button onClick={() => setLang('fr')} className={`px-2 py-0.5 text-[10px] font-bold border ${lang === 'fr' ? 'bg-hlzPurple text-black border-hlzPurple' : 'bg-black text-gray-500 border-gray-800'}`}>FR</button>
                            <button onClick={() => setLang('en')} className={`px-2 py-0.5 text-[10px] font-bold border ${lang === 'en' ? 'bg-hlzPurple text-black border-hlzPurple' : 'bg-black text-gray-500 border-gray-800'}`}>EN</button>
                        </div>
                    </div>

                    <div className="flex justify-between items-start mb-2 border-b border-gray-800 pb-2">
                        <div>
                            <h1 className="text-4xl font-bold text-white tracking-tighter leading-none flex items-center gap-3">
                                <span className="block">Habiter<br />la Zone</span>
                                {session ? <span className="text-[10px] text-green-400 border border-green-400 px-1 bg-green-400/10 tracking-normal font-normal self-center translate-y-[-2px] flex items-center gap-1"><Unlock size={10}/> ADMIN</span> : <span className="text-[10px] text-hlzPurple border border-hlzPurple px-1 bg-hlzPurple/10 tracking-normal font-normal self-center translate-y-[-2px]">SYS.ONLINE</span>}
                            </h1>
                        </div>
                    </div>
                    
                    <div className="relative mb-4 group mt-4">
                        <input type="text" placeholder={t.searchPlaceholder} className="w-full industrial-input p-2 pl-8 text-sm focus:border-hlzPurple transition-colors" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <div className="absolute left-2 top-2.5 text-gray-500"><Search size={14} /></div>
                    </div>

                    <div className="flex flex-col gap-2 mb-2 max-h-[250px] overflow-y-auto overflow-x-hidden pr-2">
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(currentHierarchy).map(parentTag => {
                                const data = currentHierarchy[parentTag];
                                const isActive = activeParentFilters.includes(parentTag);
                                return (
                                    <button key={parentTag} onClick={() => toggleParentFilter(parentTag)} style={{ borderColor: isActive ? data.color : '#333', color: isActive ? '#000' : data.color, backgroundColor: isActive ? data.color : 'transparent' }} className={`text-[10px] px-2 py-1 border transition-all uppercase hover:border-white font-bold flex items-center gap-1`}>
                                        #{parentTag} {isActive && data.children.length > 0 && <ChevronRight size={12} className="rotate-90" />}
                                    </button>
                                );
                            })}
                        </div>
                        {activeParentFilters.map(parentTag => {
                            if (currentHierarchy[parentTag]?.children.length > 0) {
                                return (
                                    <div key={`sub-${parentTag}`} className="flex flex-wrap gap-2 p-3 mt-1 ml-2 border-l-2 bg-[#050505]" style={{ borderColor: currentHierarchy[parentTag].color }}>
                                        {currentHierarchy[parentTag].children.map(childTag => {
                                            const color = currentHierarchy[parentTag].color;
                                            const isActive = activeSubFilters.includes(childTag);
                                            return (
                                                <button key={childTag} onClick={() => toggleSubFilter(childTag)} style={{ borderColor: isActive ? color : '#444', color: isActive ? '#000' : color, backgroundColor: isActive ? color : 'transparent' }} className={`text-[9px] px-2 py-0.5 border transition-all uppercase hover:border-white opacity-90`}>
                                                    {childTag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                    
                    <div className="flex justify-between items-center h-4 mb-3">
                        <span className="text-[9px] text-gray-600">{t.selectHint}</span>
                        {(activeParentFilters.length > 0 || searchQuery) && <button onClick={() => { setActiveParentFilters([]); setActiveSubFilters([]); setSearchQuery(""); }} className="text-[10px] text-gray-500 underline">{t.clear}</button>}
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">{t.mapType}:</span>
                        <div className="flex gap-1">
                            <button onClick={() => setMapStyle('dark')} className={`px-2 py-0.5 text-[9px] font-bold border uppercase transition-colors ${mapStyle === 'dark' ? 'bg-hlzPurple text-black border-hlzPurple' : 'bg-black text-gray-500 border-gray-800'}`}>{t.mapStyleDark}</button>
                            <button onClick={() => setMapStyle('light')} className={`px-2 py-0.5 text-[9px] font-bold border uppercase transition-colors ${mapStyle === 'light' ? 'bg-gray-200 text-black border-gray-200' : 'bg-black text-gray-500 border-gray-800'}`}>{t.mapStyleLight}</button>
                            <button onClick={() => setMapStyle('satellite')} className={`px-2 py-0.5 text-[9px] font-bold border uppercase transition-colors ${mapStyle === 'satellite' ? 'bg-green-700 text-white border-green-700' : 'bg-black text-gray-500 border-gray-800'}`}>{t.mapStyleSat}</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 md:top-0 md:right-0 md:left-auto w-full md:w-[420px] h-[40vh] md:h-full p-4 z-[950] pointer-events-none flex flex-col">
                <div className="industrial-panel pointer-events-auto flex-1 flex flex-col shadow-2xl md:border-l md:border-t-0 border-t border-hlzPurple/50 overflow-hidden">
                    <div className="p-4 pb-2 border-b border-gray-800 bg-[#0a0a0af0] z-20 shrink-0">
                        <h3 className="text-[10px] text-gray-500 uppercase tracking-widest flex justify-between"><span>{t.timeline}</span><span className="text-hlzPurple">[{timelineMemories.length}]</span></h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                        {timelineMemories.map(mem => {
                            const isExpanded = selectedMemory?.id === mem.id;
                            const displayDate = formatDateTime(mem.date, lang);
                            return (
                                <div key={mem.id} ref={el => timelineRefs.current[mem.id] = el} onClick={() => handleSelectMemory(mem)} className={`bg-[#050505] border transition-all duration-300 cursor-pointer group ${isExpanded ? 'border-hlzPurple' : 'border-gray-800'}`}>
                                    <div className="p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className={`text-sm font-bold pr-2 transition-colors ${isExpanded ? 'text-hlzPurple' : 'text-white'}`}>{mem.title}</h4>
                                            <span className="text-[9px] text-gray-500 whitespace-nowrap pt-1 bg-gray-900 px-1">{displayDate}</span>
                                        </div>
                                        {!isExpanded && (
                                            <div className="flex flex-wrap gap-1">
                                                {mem.tags && mem.tags.slice(0, 4).map(tag => (<span key={tag} style={{ borderColor: getDerivedTagColor(tag), color: getDerivedTagColor(tag) }} className="text-[8px] px-1 border uppercase opacity-70">#{tag}</span>))}
                                            </div>
                                        )}
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-gray-900 bg-black/40 fade-in">
                                            <div className="my-3 border border-gray-800 relative flex items-center justify-center overflow-hidden bg-black min-h-[150px]">
                                                {mem.type === 'photo' && mem.content && <img src={mem.content} onClick={() => setFullScreenItem({ type: 'photo', src: mem.content })} className="w-full h-auto max-h-[300px] object-contain grayscale hover:grayscale-0 cursor-pointer"/>}
                                                {mem.type === 'video' && mem.content && <div className="relative w-full cursor-pointer group" onClick={() => setFullScreenItem({ type: 'video', src: mem.content })}><video src={mem.content} className="w-full h-auto max-h-[300px] object-contain opacity-70"></video><span className="absolute inset-0 flex items-center justify-center text-hlzPurple">▶</span></div>}
                                                {mem.type === 'audio' && <div className="p-4 w-full flex flex-col items-center justify-center"><Mic size={24} color="#A621FF" className="mb-2" /><audio src={mem.content} controls className="w-full h-8" /></div>}
                                                {mem.type === 'text' && <FileText size={32} color="#555" />}
                                            </div>
                                            {mem.description && <p className="text-xs text-gray-400 leading-relaxed mb-3 border-l-2 border-hlzPurple pl-3 text-justify">{mem.description}</p>}
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {mem.tags && mem.tags.map(tag => (<span key={tag} style={{color: getDerivedTagColor(tag), borderColor: getDerivedTagColor(tag)}} className="text-[9px] px-1.5 py-0.5 border bg-white bg-opacity-10 uppercase">#{tag}</span>))}
                                            </div>
                                            <div className="flex items-center justify-between border-t border-gray-900 pt-2 mt-2">
                                                <div className="flex items-center text-[9px] text-gray-600 font-mono gap-1"><Crosshair size={10} /><span>{mem.lat.toFixed(4)};{mem.lng.toFixed(4)}</span></div>
                                            </div>
                                            {session && (
                                                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-800">
                                                    <button onClick={(e) => handleEditClick(mem, e)} className="text-gray-400 hover:text-blue-400 flex items-center gap-1 text-[10px] uppercase"><Edit size={12}/> {t.edit}</button>
                                                    <button onClick={(e) => handleDuplicateClick(mem, e)} className="text-gray-400 hover:text-green-400 flex items-center gap-1 text-[10px] uppercase"><Copy size={12}/> {t.duplicate}</button>
                                                    <button onClick={(e) => handleDeleteMemory(mem.id, e)} className="text-gray-400 hover:text-red-500 flex items-center gap-1 text-[10px] uppercase"><Trash2 size={12}/> {t.delete}</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {showTagManager && session && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="industrial-panel p-6 w-full max-w-md shadow-[0_0_50px_rgba(166,33,255,0.2)] border-hlzPurple fade-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                            <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2"><Tag size={18}/> {t.manageTags}</h2>
                            <button onClick={() => { setShowTagManager(false); handleCancelTagEdit(); }} className="text-gray-500 hover:text-hlzPurple"><X /></button>
                        </div>
                        
                        <div className="max-h-[40vh] overflow-y-auto mb-6 space-y-2 pr-2">
                            {allParentOptions.map(parentName => {
                                const parentData = currentHierarchy[parentName];
                                const parentDbTag = dbTags.find(t => t.name.toLowerCase() === parentName && !t.parent_name);
                                
                                if (!parentDbTag) return null;

                                return (
                                <React.Fragment key={`group-${parentName}`}>
                                    <div className="flex justify-between items-center bg-[#111] border border-gray-700 p-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-4 h-4 rounded-full border border-gray-500" style={{ backgroundColor: parentData.color }}></div>
                                            <span className="text-sm uppercase font-bold text-white">#{parentName}</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleEditTagClick(parentDbTag)} className="text-gray-500 hover:text-blue-400"><Edit size={14}/></button>
                                            <button onClick={() => handleDeleteTag(parentDbTag.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                    {dbTags.filter(child => child.parent_name?.toLowerCase() === parentName).map(child => (
                                        <div key={child.id} className="flex justify-between items-center bg-[#050505] p-2 ml-6 border-l-2 border-gray-500">
                                            <span className="text-sm uppercase text-gray-400">↳ {child.name}</span>
                                            <div className="flex gap-3">
                                                <button onClick={() => handleEditTagClick(child)} className="text-gray-500 hover:text-blue-400"><Edit size={14}/></button>
                                                <button onClick={() => handleDeleteTag(child.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            )})}
                            {dbTags.length === 0 && <p className="text-xs text-gray-500">Aucun tag trouvé. Créez-en un nouveau!</p>}
                        </div>

                        <div className="border-t border-gray-800 pt-4 bg-[#0a0a0a] -mx-6 -mb-6 p-6">
                            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">{editingTagId ? t.editTag : t.newTag}</h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2 items-center">
                                    <input type="text" placeholder={t.tagName} className="flex-1 industrial-input p-2 text-sm" value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                                    {newTagParentName === "" && <input type="color" className="w-10 h-10 bg-transparent cursor-pointer border-0 p-0" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} />}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <select className="flex-1 industrial-input p-2 text-xs text-gray-400" value={newTagParentName} onChange={(e) => setNewTagParentName(e.target.value)}>
                                        <option value="">[ Nova Categoria Principal ]</option>
                                        {allParentOptions.map(parent => (
                                            <option key={`opt-${parent}`} value={parent}>#{parent}</option>
                                        ))}
                                    </select>
                                    {editingTagId ? (
                                        <div className="flex gap-1">
                                            <button onClick={handleSaveTag} className="bg-hlzPurple text-black font-bold px-3 py-2 text-[10px] uppercase">Salvar</button>
                                            <button onClick={handleCancelTagEdit} className="bg-gray-800 text-gray-400 font-bold px-3 py-2"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <button onClick={handleSaveTag} className="bg-hlzPurple text-black font-bold px-4 py-2 text-[10px] uppercase">Add</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLogin && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="industrial-panel p-6 w-full max-w-sm shadow-[0_0_50px_rgba(166,33,255,0.2)] border-hlzPurple fade-in">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                            <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2"><Lock size={18}/> {t.login}</h2>
                            <button onClick={() => setShowLogin(false)} className="text-gray-500"><X /></button>
                        </div>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input type="email" placeholder={t.email} required className="w-full industrial-input p-3" value={email} onChange={e => setEmail(e.target.value)} />
                            <input type="password" placeholder={t.password} required className="w-full industrial-input p-3" value={password} onChange={e => setPassword(e.target.value)} />
                            <button type="submit" className="w-full bg-hlzPurple text-black font-bold py-3 uppercase">Entrar</button>
                        </form>
                    </div>
                </div>
            )}

            {isAdding && session && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1100] w-11/12 max-w-md">
                    {/* ADICIONADO AQUI: max-h-[90vh] e overflow-y-auto PARA O FORMULÁRIO RESPONSIVO */}
                    <div className="industrial-panel p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] border-hlzPurple max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                            <h2 className="text-xl font-bold text-white uppercase">{editingId ? t.editSignal : t.newSignal}</h2>
                            <button onClick={closeModal} className="text-gray-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <input type="text" placeholder={t.idPlace} className="w-full industrial-input p-3" value={newMemory.title} onChange={e => setNewMemory({...newMemory, title: e.target.value})} />
                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col gap-1"><label className="text-[10px] text-gray-500 uppercase">{t.lat}</label><input type="number" step="any" className="w-full industrial-input p-2 text-sm" value={newMemory.lat} onChange={e => setNewMemory({...newMemory, lat: e.target.value})} /></div>
                                <div className="flex-1 flex flex-col gap-1"><label className="text-[10px] text-gray-500 uppercase">{t.lng}</label><input type="number" step="any" className="w-full industrial-input p-2 text-sm" value={newMemory.lng} onChange={e => setNewMemory({...newMemory, lng: e.target.value})} /></div>
                            </div>
                            
                            {/* --- INSERÇÃO DA DATA E HORA --- */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest">{t.dateTimeStr}</label>
                                <input type="datetime-local" className="w-full industrial-input p-2 text-sm text-gray-200" value={newMemory.datetime} onChange={e => setNewMemory({...newMemory, datetime: e.target.value})} />
                            </div>
                            {/* ----------------------------------- */}

                            <div className="flex gap-2">
                                {['text', 'photo', 'video', 'audio'].map(type => (
                                    <button key={type} onClick={(e) => { e.preventDefault(); setNewMemory({...newMemory, type}) }} className={`flex-1 py-1 text-[10px] uppercase border ${newMemory.type === type ? 'bg-hlzPurple text-black border-hlzPurple font-bold' : 'border-gray-700 text-gray-500'}`}>{t.types[type]}</button>
                                ))}
                            </div>

                            {/* --- INSERÇÃO DA DIREÇÃO DA FOTO (ÂNGULO) --- */}
                            <div className="flex justify-between items-center bg-[#050505] border border-gray-800 p-3">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-gray-500 uppercase">{t.directionView}:</span>
                                    <div className="relative w-12 h-12 flex items-center justify-center border-2 border-[#1e2029] bg-[#0a0a0c] rounded-full overflow-hidden shadow-[0_0_15px_rgba(166,33,255,0.1)]">
                                        <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', transform: `rotate(${newMemory.direction || 0}deg)`, transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}><path d="M24,24 L6,4 A26,26 0 0,1 42,4 Z" fill="rgba(166, 33, 255, 0.6)" stroke="#D8B4FE" strokeWidth="1.5" /></svg>
                                        <div className="absolute w-3 h-3 bg-white transform rotate-45 z-10 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {[{v: 0, l: '↑'}, {v: 90, l: '→'}, {v: 180, l: '↓'}, {v: 270, l: '←'}].map(dir => (
                                        <button key={dir.v} onClick={(e) => { e.preventDefault(); setNewMemory({...newMemory, direction: dir.v}) }} className={`w-8 h-8 flex items-center justify-center border text-sm transition-colors ${newMemory.direction === dir.v ? 'bg-hlzPurple text-black border-hlzPurple' : 'border-gray-700 text-gray-500 hover:border-hlzPurple hover:text-white'}`}>{dir.l}</button>
                                    ))}
                                </div>
                            </div>

                            <textarea placeholder={t.notes} className="w-full industrial-input p-3 h-20 resize-none" value={newMemory.description} onChange={e => setNewMemory({...newMemory, description: e.target.value})}></textarea>
                            <input type="text" placeholder={t.mediaUrl} className="w-full industrial-input p-3 text-xs" value={newMemory.content} onChange={e => setNewMemory({...newMemory, content: e.target.value})} />
                            
                            <div className="w-full industrial-input p-3 space-y-3 bg-[#050505]">
                                <span className="text-[10px] text-gray-500 uppercase block">Tags</span>
                                <div className="max-h-[120px] overflow-y-auto pr-2 space-y-3">
                                    {Object.entries(currentHierarchy).map(([parent, data]) => (
                                        <div key={parent} className="border-l-2 pl-2" style={{ borderColor: data.color }}>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); const tgs = newMemory.tags ? newMemory.tags.split(',').map(t=>t.trim()).filter(Boolean) : []; setNewMemory({...newMemory, tags: (tgs.includes(parent) ? tgs.filter(t=>t!==parent) : [...tgs, parent]).join(', ')}); }}
                                                className={`text-[10px] px-2 py-0.5 border uppercase font-bold mb-1`}
                                                style={{ backgroundColor: newMemory.tags?.split(',').map(t=>t.trim()).includes(parent) ? data.color : 'transparent', borderColor: data.color, color: newMemory.tags?.split(',').map(t=>t.trim()).includes(parent) ? '#000' : data.color }}
                                            >#{parent}</button>
                                            <div className="flex flex-wrap gap-1 ml-2">
                                                {data.children.map(child => {
                                                    const isSel = newMemory.tags?.split(',').map(t=>t.trim()).includes(child);
                                                    return (
                                                    <button key={child} onClick={(e) => { e.preventDefault(); const tgs = newMemory.tags ? newMemory.tags.split(',').map(t=>t.trim()).filter(Boolean) : []; if (!tgs.includes(child) && !tgs.includes(parent)) tgs.push(parent); setNewMemory({...newMemory, tags: (tgs.includes(child) ? tgs.filter(t=>t!==child) : [...tgs, child]).join(', ')}); }} className={`text-[9px] px-1.5 py-0.5 border uppercase`} style={{ backgroundColor: isSel ? data.color : 'transparent', borderColor: isSel ? data.color : '#333', color: isSel ? '#000' : '#888' }}>
                                                        {child}
                                                    </button>
                                                )})}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <input type="text" placeholder="Tags manuais (vírgula)..." className="w-full bg-transparent border-t border-gray-800 pt-2 text-xs focus:outline-none" value={newMemory.tags} onChange={e => setNewMemory({...newMemory, tags: e.target.value})} />
                            </div>

                            <button onClick={handleSaveMemory} className="w-full bg-hlzPurple text-black font-bold py-3 uppercase">Salvar Ponto</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ABOUT (À PROPOS) - Restaurado */}
            {aboutTab && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="industrial-panel p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto fade-in shadow-[0_0_50px_rgba(166,33,255,0.2)] border-hlzPurple">
                        <div className="flex justify-between items-start mb-6 border-b border-gray-800 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2"><span className="w-1.5 h-1.5 bg-hlzPurple animate-pulse"></span><p className="text-hlzPurple text-[10px] tracking-widest font-bold uppercase">INFO SYS</p></div>
                                <h2 className="text-3xl font-bold text-white uppercase leading-none tracking-tight">{aboutTab === 'project' ? t.aboutTitle : t.authorTitle}</h2>
                            </div>
                            <button onClick={() => setAboutTab(null)} className="text-gray-600 hover:text-white transition-colors"><X size={24}/></button>
                        </div>
                        <div className="flex gap-6 mb-8 border-b border-gray-800">
                            <button onClick={() => setAboutTab('project')} className={`pb-2 text-sm font-bold uppercase tracking-widest transition-colors ${aboutTab === 'project' ? 'text-hlzPurple border-b-2 border-hlzPurple' : 'text-gray-500 hover:text-gray-300'}`}>{t.aboutTitle}</button>
                            <button onClick={() => setAboutTab('author')} className={`pb-2 text-sm font-bold uppercase tracking-widest transition-colors ${aboutTab === 'author' ? 'text-hlzPurple border-b-2 border-hlzPurple' : 'text-gray-500 hover:text-gray-300'}`}>{t.authorTitle}</button>
                        </div>
                        <div className="space-y-8 flex-1">
                            {aboutTab === 'project' && (
                                <div className="fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-white uppercase mb-4 border-l-2 border-hlzPurple pl-3">{t.aboutProjectTitle}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed text-justify font-light">{t.aboutProjectDesc}</p>
                                    </div>
                                    <div className="bg-black border border-gray-800 relative group flex items-center justify-center p-4 min-h-[200px]">
                                        <div className="relative z-10 flex flex-col items-center gap-2">
                                            <Radio size={32} color="#A621FF" />
                                            <span className="bg-black/80 px-3 py-1 text-[10px] text-hlzPurple border border-hlzPurple/30 tracking-widest uppercase backdrop-blur-sm">RADIAN RESEARCH PROGRAM</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {aboutTab === 'author' && (
                                <div className="fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-white uppercase mb-4 border-l-2 border-hlzPurple pl-3">{t.aboutAuthorTitle}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed text-justify font-light">{t.aboutAuthorDesc}</p>
                                    </div>
                                    <div className="bg-black border border-gray-800 relative group flex items-center justify-center p-4 min-h-[200px]">
                                        <div className="relative z-10 flex flex-col items-center gap-2">
                                            <User size={32} color="#A621FF" />
                                            <span className="bg-black/80 px-3 py-1 text-[10px] text-hlzPurple border border-hlzPurple/30 tracking-widest uppercase backdrop-blur-sm">ARCHITECTE & CHERCHEUSE</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {fullScreenItem && (
                <div className="fixed inset-0 z-[3000] bg-black/95 flex items-center justify-center p-4 fade-in" onClick={() => setFullScreenItem(null)}>
                    <button className="absolute top-6 right-6 text-gray-400 bg-black/50 p-2 rounded-full"><X size={32} /></button>
                    {fullScreenItem.type === 'photo' ? <img src={fullScreenItem.src} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} /> : <video src={fullScreenItem.src} controls autoPlay className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}></video>}
                </div>
            )}
        </div>
    );
};

export default App;