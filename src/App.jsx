import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X, Crosshair, Mic, FileText, Lock, Unlock, LogOut, Edit, Trash2, Copy, Tag, ChevronRight, Menu } from 'lucide-react';
import { supabase } from './supabase';

const PALETTE = { purple: '#A621FF', neutralBg: '#0A0A0A' };

const TRANSLATIONS = {
    fr: {
        subtitle: "Journal de terrain(s)", searchPlaceholder: "Rechercher...", clear: "Effacer les filtres", newSignal: "Nouveau Signal", editSignal: "Éditer", 
        idPlace: "Identifiant", notes: "Notes...", mediaUrl: "URL", dateTimeStr: "Date et Heure", save: "Enregistrer", context: "Tags", lat: "Lat", lng: "Lng",
        types: { text: "Texte", photo: "Photo", galerie: "Galerie", video: "Vidéo", audio: "Audio" }, selectHint: "Filtres", timeline: "Chronologie",
        aboutProjectBtn: "À Propos", aboutAuthorBtn: "Misia Forlen", aboutTitle: "À Propos", authorTitle: "Misia Forlen",
        aboutProjectTitle: "Le Projet", aboutProjectDesc: "« Habiter la zone » est un projet de recherche-création qui s’intéresse aux pratiques quotidiennes des travailleurs·ses mobiles dans les Zones Économiques Spéciales (ZES), modèles de zones franches fonctionnant comme des enclaves économiques et fiscales. Au croisement des sciences sociales, de l’architecture et des arts visuels, cette thèse explore des formes de créations qui nourrissent en retour la recherche sur l’habiter, en lien avec les mutations du travail et des territoires industriels. Ce doctorat s’articule autour de plusieurs productions : un mémoire théorique, des créations audiovisuelles et un journal de bord, sous forme d’une carte en ligne, interactive et évolutive, permettant de spatialiser les observations, réflexions, hypothèses, tout comme les images et les sons, issus du travail hybride de recherche et de création.", aboutAuthorTitle: "L'Auteure",
        aboutAuthorDesc: "Architecte D.E., ATER en sociologie à l’Université Le Havre Normandie – laboratoire IDEES-Le Havre et doctorante au sein du programme doctoral RADIAN (Recherches en Art, Design, Innovation, Architecture en Normandie).\n\nPortrait réalisé par Magali Massoud lors du colloque \"En-quête de terrains : l’art de croiser les gens\", le 16/01/2023.", mapType: "Carte", mapStyleDark: "Sombre", mapStyleLight: "Clair", mapStyleSat: "Sat", directionView: "Angle de Vue",
        login: "Connexion", email: "E-mail", password: "Mot de passe", enter: "Entrer", edit: "Éditer", duplicate: "Dupliquer", delete: "Supprimer", deleteConfirm: "Sûr?",
        manageTags: "Gérer les Tags", newTag: "Nouveau Tag", editTag: "Éditer Tag", tagName: "Nom", tagColor: "Couleur", addTag: "Ajouter"
    },
    en: {
        subtitle: "Mapping System", searchPlaceholder: "Search...", clear: "Clear filters", newSignal: "New Signal", editSignal: "Edit", 
        idPlace: "ID", notes: "Notes...", mediaUrl: "URL", dateTimeStr: "Date & Time", save: "Save", context: "Tags", lat: "Lat", lng: "Lng",
        types: { text: "Text", photo: "Photo", galerie: "Gallery", video: "Video", audio: "Audio" }, selectHint: "Filters", timeline: "Timeline",
        aboutProjectBtn: "About", aboutAuthorBtn: "Misia Forlen", aboutTitle: "About", authorTitle: "Misia Forlen",
        aboutProjectTitle: "The Project", aboutProjectDesc: "« Habiter la zone » est un projet de recherche-création qui s’intéresse aux pratiques quotidiennes des travailleurs·ses mobiles dans les Zones Économiques Spéciales (ZES), modèles de zones franches fonctionnant comme des enclaves économiques et fiscales. Au croisement des sciences sociales, de l’architecture et des arts visuels, cette thèse explore des formes de créations qui nourrissent en retour la recherche sur l’habiter, en lien avec les mutations du travail et des territoires industriels. Ce doctorat s’articule autour de plusieurs productions : un mémoire théorique, des créations audiovisuelles et un journal de bord, sous forme d’une carte en ligne, interactive et évolutive, permettant de spatialiser les observations, réflexions, hypothèses, tout comme les images et les sons, issus du travail hybride de recherche et de création.", aboutAuthorTitle: "The Author",
        aboutAuthorDesc: "Architecte D.E., ATER en sociologie à l’Université Le Havre Normandie – laboratoire IDEES-Le Havre et doctorante au sein du programme doctoral RADIAN (Recherches en Art, Design, Innovation, Architecture en Normandie).\n\nPortrait réalisé par Magali Massoud lors du colloque \"En-quête de terrains : l’art de croiser les gens\", le 16/01/2023.", mapType: "Map", mapStyleDark: "Dark", mapStyleLight: "Light", mapStyleSat: "Sat", directionView: "View Direction",
        login: "Login", email: "Email", password: "Password", enter: "Enter", edit: "Edit", duplicate: "Duplicate", delete: "Delete", deleteConfirm: "Sure?",
        manageTags: "Manage Tags", newTag: "New Tag", editTag: "Edit Tag", tagName: "Name", tagColor: "Color", addTag: "Add"
    }
};

const formatDateTime = (datetimeStr, lang) => {
    if (!datetimeStr) return "";
    try {
        let cleanStr = datetimeStr;
        if (cleanStr.includes('T')) {
            cleanStr = cleanStr.slice(0, 16); 
            const [datePart, timePart] = cleanStr.split('T');
            const [year, month, day] = datePart.split('-');
            const [hours, minutes] = timePart.split(':');
            
            if (lang === 'fr') {
                return `${day}-${month}-${year} à ${hours}:${minutes}`;
            } else {
                let h = parseInt(hours, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                return `${year}-${month}-${day} at ${String(h).padStart(2, '0')}:${minutes} ${ampm}`;
            }
        }
        return datetimeStr; 
    } catch (error) {
        console.debug("Format date error:", error);
        return datetimeStr;
    }
};

const ExpandableText = ({ text, lang }) => {
    const [expanded, setExpanded] = useState(false);
    if (!text) return null;
    if (text.length <= 180) {
        return <p className="text-xs text-gray-400 leading-relaxed mb-3 border-l-2 border-hlzPurple pl-3 text-justify whitespace-pre-wrap">{text}</p>;
    }

    return (
        <div className="mb-3 border-l-2 border-hlzPurple pl-3">
            <p className="text-xs text-gray-400 leading-relaxed text-justify whitespace-pre-wrap">
                {expanded ? text : `${text.substring(0, 180)}...`}
            </p>
            <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="text-[10px] text-hlzPurple hover:text-white mt-1 font-bold uppercase transition-colors"
            >
                {expanded ? (lang === 'fr' ? 'Voir moins' : 'See less') : (lang === 'fr' ? 'Voir plus' : 'See more')}
            </button>
        </div>
    );
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isTimelineMinimized, setIsTimelineMinimized] = useState(false); // NOVO ESTADO: Gaveta do mapa
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

    const timelineMemories = useMemo(() => [...filteredMemories].sort((a, b) => {
        return (b.date || "").localeCompare(a.date || "");
    }), [filteredMemories]);

    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([49.52, -1.80], 12);
            tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 20 }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            setTimeout(() => map.invalidateSize(), 250);

            map.on('click', (e) => {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session && !showTagManager) { 
                        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                        const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
                        
                        setEditingId(null); 
                        setNewMemory({ lat: e.latlng.lat, lng: e.latlng.lng, title: "", description: "", type: "text", tags: "", content: "", direction: 0, datetime: localISOTime });
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
        setSelectedMemory(mem); 
        setAboutTab(null); 
        setIsAdding(false);
        setIsTimelineMinimized(false); // SE CLICAR NO MAPA, A GAVETA ABRE SOZINHA
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
        const formattedDate = mem.date ? mem.date.slice(0, 16) : "";
        setNewMemory({ ...mem, datetime: formattedDate, tags: mem.tags ? mem.tags.join(', ') : "" }); 
        setEditingId(mem.id); 
        setIsAdding(true); 
    };
    
    const handleDuplicateClick = (mem, e) => { 
        e.stopPropagation(); 
        const formattedDate = mem.date ? mem.date.slice(0, 16) : "";
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
        <div className="relative w-full h-screen font-mono text-gray-200 overflow-hidden">
            <div ref={mapRef} id="map" className="h-full w-full absolute inset-0 z-0"></div>

            {/* HEADER GLOBAL / MOBILE SEARCH */}
            <div className="absolute top-0 left-0 w-full md:w-[400px] p-2 md:p-4 z-[1000] pointer-events-none flex flex-col gap-2">
                <div className="industrial-panel p-3 md:p-5 border-l-4 border-l-hlzPurple pointer-events-auto flex flex-col shadow-2xl">
                    
                    <div className="flex items-center gap-3 mb-3">
                        <button onClick={() => setIsMenuOpen(true)} className="text-gray-300 hover:text-white transition-colors bg-gray-900 p-2 rounded-sm border border-gray-800">
                            <Menu size={20} />
                        </button>
                        <h1 className="text-xl md:text-3xl font-bold text-white tracking-tighter leading-none flex items-center gap-2 flex-1">
                            Habiter la Zone
                            {session && <span className="text-[8px] md:text-[10px] text-green-400 border border-green-400 px-1 bg-green-400/10 tracking-normal font-normal flex items-center gap-1"><Unlock size={8}/></span>}
                        </h1>
                    </div>

                    <div className="relative mb-3 shrink-0">
                        <input type="text" placeholder={t.searchPlaceholder} className="w-full industrial-input p-3 pl-10 text-sm focus:border-hlzPurple transition-colors shadow-inner rounded" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <div className="absolute left-3 top-3 text-gray-500"><Search size={16} /></div>
                        {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-gray-500 hover:text-white"><X size={16} /></button>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex overflow-x-auto gap-2 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
                            {Object.keys(currentHierarchy).map(parentTag => {
                                const data = currentHierarchy[parentTag];
                                const isActive = activeParentFilters.includes(parentTag);
                                return (
                                    <button key={parentTag} onClick={() => toggleParentFilter(parentTag)} style={{ borderColor: isActive ? data.color : '#333', color: isActive ? '#000' : data.color, backgroundColor: isActive ? data.color : 'transparent' }} className={`text-[10px] md:text-xs px-3 py-1.5 border transition-all uppercase hover:border-white font-bold flex items-center gap-1 whitespace-nowrap snap-start shrink-0 rounded`}>
                                        #{parentTag} {isActive && data.children.length > 0 && <ChevronRight size={12} className="rotate-90" />}
                                    </button>
                                );
                            })}
                        </div>
                        {activeParentFilters.map(parentTag => {
                            if (currentHierarchy[parentTag]?.children.length > 0) {
                                return (
                                    <div key={`sub-${parentTag}`} className="flex overflow-x-auto gap-2 pb-1 pl-2 border-l-2 bg-[#050505] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ borderColor: currentHierarchy[parentTag].color }}>
                                        {currentHierarchy[parentTag].children.map(childTag => {
                                            const color = currentHierarchy[parentTag].color;
                                            const isActive = activeSubFilters.includes(childTag);
                                            return (
                                                <button key={childTag} onClick={() => toggleSubFilter(childTag)} style={{ borderColor: isActive ? color : '#444', color: isActive ? '#000' : color, backgroundColor: isActive ? color : 'transparent' }} className={`text-[9px] md:text-[10px] px-2 py-1 border transition-all uppercase hover:border-white opacity-90 whitespace-nowrap shrink-0 rounded-sm`}>
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

                    {(activeParentFilters.length > 0 || searchQuery) && (
                        <div className="flex justify-end pt-2 mt-1">
                            <button onClick={() => { setActiveParentFilters([]); setActiveSubFilters([]); setSearchQuery(""); }} className="text-[10px] text-gray-500 hover:text-white transition-colors">{t.clear}</button>
                        </div>
                    )}
                </div>
            </div>

            {/* DRAWER MENU */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[3000] flex bg-black/70 backdrop-blur-sm fade-in" onClick={() => setIsMenuOpen(false)}>
                    <div className="w-[80%] max-w-[320px] h-full bg-[#0a0a0a] border-r border-gray-800 shadow-[20px_0_50px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                        
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                            <h2 className="text-xl font-bold text-white tracking-widest uppercase">Menu</h2>
                            <button onClick={() => setIsMenuOpen(false)} className="text-gray-500 hover:text-white bg-gray-900 p-2 rounded"><X size={18}/></button>
                        </div>

                        <div className="flex flex-col gap-5 flex-1">
                            <button onClick={() => {setAboutTab('project'); setIsMenuOpen(false);}} className="text-left text-sm text-gray-300 hover:text-hlzPurple uppercase tracking-widest transition-colors font-bold">{t.aboutProjectBtn}</button>
                            <button onClick={() => {setAboutTab('author'); setIsMenuOpen(false);}} className="text-left text-sm text-gray-300 hover:text-hlzPurple uppercase tracking-widest transition-colors font-bold">{t.aboutAuthorBtn}</button>

                            <div className="h-px bg-gray-800 w-full my-1"></div>

                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] text-gray-600 uppercase tracking-widest">Langue / Language:</span>
                                <div className="flex gap-2">
                                    <button onClick={() => {setLang('fr'); setIsMenuOpen(false);}} className={`flex-1 py-2 text-xs font-bold border rounded ${lang === 'fr' ? 'bg-hlzPurple text-black border-hlzPurple' : 'bg-black text-gray-500 border-gray-800 hover:border-gray-500'}`}>FR</button>
                                    <button onClick={() => {setLang('en'); setIsMenuOpen(false);}} className={`flex-1 py-2 text-xs font-bold border rounded ${lang === 'en' ? 'bg-hlzPurple text-black border-hlzPurple' : 'bg-black text-gray-500 border-gray-800 hover:border-gray-500'}`}>EN</button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-2">
                                <span className="text-[10px] text-gray-600 uppercase tracking-widest">{t.mapType}:</span>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => {setMapStyle('dark'); setIsMenuOpen(false);}} className={`py-2 text-xs font-bold border rounded uppercase transition-colors ${mapStyle === 'dark' ? 'bg-hlzPurple text-black border-hlzPurple' : 'bg-black text-gray-500 border-gray-800 hover:border-gray-500'}`}>{t.mapStyleDark}</button>
                                    <button onClick={() => {setMapStyle('light'); setIsMenuOpen(false);}} className={`py-2 text-xs font-bold border rounded uppercase transition-colors ${mapStyle === 'light' ? 'bg-gray-200 text-black border-gray-200' : 'bg-black text-gray-500 border-gray-800 hover:border-gray-500'}`}>{t.mapStyleLight}</button>
                                    <button onClick={() => {setMapStyle('satellite'); setIsMenuOpen(false);}} className={`py-2 text-xs font-bold border rounded uppercase transition-colors ${mapStyle === 'satellite' ? 'bg-green-700 text-white border-green-700' : 'bg-black text-gray-500 border-gray-800 hover:border-gray-500'}`}>{t.mapStyleSat}</button>
                                </div>
                            </div>

                            <div className="mt-auto flex flex-col gap-4 border-t border-gray-800 pt-6">
                                {session ? (
                                    <>
                                        <button onClick={() => { setShowTagManager(true); setIsMenuOpen(false); }} className="text-left text-sm text-gray-400 hover:text-white uppercase tracking-widest flex items-center gap-3"><Tag size={16}/> {t.manageTags}</button>
                                        <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-left text-sm text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-3"><LogOut size={16}/> Logout</button>
                                    </>
                                ) : (
                                    <button onClick={() => { setShowLogin(true); setIsMenuOpen(false); }} className="text-left text-sm text-gray-400 hover:text-white uppercase tracking-widest flex items-center gap-3"><Lock size={16}/> {t.login} Admin</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAINEL DA CRONOLOGIA COM SISTEMA DE GAVETA (MINIMIZAR/MAXIMIZAR) NO MOBILE */}
            <div className={`absolute bottom-0 left-0 md:top-0 md:right-0 md:left-auto w-full md:w-[420px] transition-all duration-300 z-[950] pointer-events-none flex flex-col p-2 md:p-4 ${isTimelineMinimized ? 'h-[75px] md:h-full' : 'h-[45vh] md:h-full'}`}>
                <div className="industrial-panel pointer-events-auto flex-1 flex flex-col shadow-2xl md:border-l md:border-t-0 border-t-2 border-hlzPurple overflow-hidden bg-[#0a0a0af0]">
                    
                    {/* HANDLE MOBILE (Barra cinza no topo) */}
                    <div 
                        className="w-full flex justify-center pt-3 pb-1 md:hidden cursor-pointer"
                        onClick={() => setIsTimelineMinimized(!isTimelineMinimized)}
                    >
                        <div className="w-12 h-1.5 bg-gray-600 rounded-full"></div>
                    </div>

                    {/* CABEÇALHO (Também serve para abrir/fechar no celular) */}
                    <div 
                        className="px-4 pb-2 pt-1 md:pt-4 border-b border-gray-800 z-20 shrink-0 flex justify-between items-center cursor-pointer md:cursor-default"
                        onClick={() => setIsTimelineMinimized(!isTimelineMinimized)}
                    >
                        <h3 className="text-[10px] text-gray-500 uppercase tracking-widest">{t.timeline}</h3>
                        <span className="text-[10px] text-hlzPurple font-bold">[{timelineMemories.length}]</span>
                    </div>

                    <div className={`flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-3 ${isTimelineMinimized ? 'hidden md:flex' : 'flex'}`}>
                        {timelineMemories.map(mem => {
                            const isExpanded = selectedMemory?.id === mem.id;
                            const displayDate = formatDateTime(mem.date, lang);
                            return (
                                <div key={mem.id} ref={el => timelineRefs.current[mem.id] = el} onClick={() => handleSelectMemory(mem)} className={`bg-[#050505] border transition-all duration-300 cursor-pointer group rounded-sm ${isExpanded ? 'border-hlzPurple' : 'border-gray-800'}`}>
                                    <div className="p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className={`text-sm font-bold pr-2 transition-colors ${isExpanded ? 'text-hlzPurple' : 'text-white'}`}>{mem.title}</h4>
                                            <span className="text-[9px] text-gray-500 whitespace-nowrap pt-1 bg-gray-900 px-1 rounded-sm">{displayDate}</span>
                                        </div>
                                        {!isExpanded && (
                                            <div className="flex flex-wrap gap-1">
                                                {mem.tags && mem.tags.slice(0, 4).map(tag => (<span key={tag} style={{ borderColor: getDerivedTagColor(tag), color: getDerivedTagColor(tag) }} className="text-[8px] px-1 border uppercase opacity-70 rounded-sm">#{tag}</span>))}
                                            </div>
                                        )}
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-gray-900 bg-black/40 fade-in rounded-b-sm">
                                            <div className="my-3 border border-gray-800 relative flex items-center justify-center overflow-hidden bg-black min-h-[150px] p-2 rounded">
                                                {mem.type === 'photo' && mem.content && <img src={mem.content} onClick={(e) => { e.stopPropagation(); setFullScreenItem({ type: 'photo', src: mem.content }); }} className="w-full h-auto max-h-[300px] object-contain grayscale hover:grayscale-0 cursor-pointer rounded"/>}
                                                
                                                {mem.type === 'galerie' && mem.content && (
                                                    <div className="flex w-full overflow-x-auto gap-2 pb-2 snap-x snap-mandatory">
                                                        {mem.content.split(',').map((url, i) => url.trim() ? (
                                                            <img key={i} src={url.trim()} onClick={(e) => { e.stopPropagation(); setFullScreenItem({ type: 'galerie', urls: mem.content.split(',').map(u=>u.trim()).filter(Boolean), currentIndex: i }); }} className="h-40 w-auto object-cover grayscale hover:grayscale-0 cursor-pointer snap-center border border-gray-800 rounded" alt={`galerie-${i}`}/>
                                                        ) : null)}
                                                    </div>
                                                )}

                                                {mem.type === 'video' && mem.content && <div className="relative w-full cursor-pointer group" onClick={(e) => { e.stopPropagation(); setFullScreenItem({ type: 'video', src: mem.content }); }}><video src={mem.content} className="w-full h-auto max-h-[300px] object-contain opacity-70 rounded"></video><span className="absolute inset-0 flex items-center justify-center text-hlzPurple">▶</span></div>}
                                                {mem.type === 'audio' && <div className="p-4 w-full flex flex-col items-center justify-center"><Mic size={24} color="#A621FF" className="mb-2" /><audio src={mem.content} controls className="w-full h-8 rounded" /></div>}
                                                {mem.type === 'text' && <FileText size={32} color="#555" />}
                                            </div>
                                            
                                            {mem.description && <ExpandableText text={mem.description} lang={lang} />}
                                            
                                            <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
                                                {mem.tags && mem.tags.map(tag => (<span key={tag} style={{color: getDerivedTagColor(tag), borderColor: getDerivedTagColor(tag)}} className="text-[9px] px-2 py-0.5 border bg-white bg-opacity-10 uppercase rounded">#{tag}</span>))}
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

            {/* PAINÉIS DE ADMIN */}
            {showTagManager && session && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="industrial-panel p-6 w-full max-w-md shadow-[0_0_50px_rgba(166,33,255,0.2)] border-hlzPurple fade-in max-h-[90vh] overflow-y-auto rounded">
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
                                    <div className="flex justify-between items-center bg-[#111] border border-gray-700 p-2 rounded">
                                        <div className="flex items-center gap-3">
                                            <div className="w-4 h-4 rounded border border-gray-500" style={{ backgroundColor: parentData.color }}></div>
                                            <span className="text-sm uppercase font-bold text-white">#{parentName}</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleEditTagClick(parentDbTag)} className="text-gray-500 hover:text-blue-400"><Edit size={14}/></button>
                                            <button onClick={() => handleDeleteTag(parentDbTag.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                    {dbTags.filter(child => child.parent_name?.toLowerCase() === parentName).map(child => (
                                        <div key={child.id} className="flex justify-between items-center bg-[#050505] p-2 ml-6 border-l-2 border-gray-500 rounded">
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

                        <div className="border-t border-gray-800 pt-4 bg-[#0a0a0a] -mx-6 -mb-6 p-6 rounded-b">
                            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">{editingTagId ? t.editTag : t.newTag}</h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2 items-center">
                                    <input type="text" placeholder={t.tagName} className="flex-1 industrial-input p-2 text-sm rounded" value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                                    {newTagParentName === "" && <input type="color" className="w-10 h-10 bg-transparent cursor-pointer border-0 p-0 rounded" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} />}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <select className="flex-1 industrial-input p-2 text-xs text-gray-400 rounded" value={newTagParentName} onChange={(e) => setNewTagParentName(e.target.value)}>
                                        <option value="">[ Nova Categoria Principal ]</option>
                                        {allParentOptions.map(parent => (
                                            <option key={`opt-${parent}`} value={parent}>#{parent}</option>
                                        ))}
                                    </select>
                                    {editingTagId ? (
                                        <div className="flex gap-1">
                                            <button onClick={handleSaveTag} className="bg-hlzPurple text-black font-bold px-3 py-2 text-[10px] uppercase rounded">Salvar</button>
                                            <button onClick={handleCancelTagEdit} className="bg-gray-800 text-gray-400 font-bold px-3 py-2 rounded"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <button onClick={handleSaveTag} className="bg-hlzPurple text-black font-bold px-4 py-2 text-[10px] uppercase rounded">Add</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLogin && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="industrial-panel p-6 w-full max-w-sm shadow-[0_0_50px_rgba(166,33,255,0.2)] border-hlzPurple fade-in rounded">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                            <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2"><Lock size={18}/> {t.login}</h2>
                            <button onClick={() => setShowLogin(false)} className="text-gray-500"><X /></button>
                        </div>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input type="email" placeholder={t.email} required className="w-full industrial-input p-3 rounded" value={email} onChange={e => setEmail(e.target.value)} />
                            <input type="password" placeholder={t.password} required className="w-full industrial-input p-3 rounded" value={password} onChange={e => setPassword(e.target.value)} />
                            <button type="submit" className="w-full bg-hlzPurple text-black font-bold py-3 uppercase rounded">Entrar</button>
                        </form>
                    </div>
                </div>
            )}

            {isAdding && session && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[4000] w-11/12 max-w-md">
                    <div className="industrial-panel p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] border-hlzPurple max-h-[90vh] overflow-y-auto rounded">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                            <h2 className="text-xl font-bold text-white uppercase">{editingId ? t.editSignal : t.newSignal}</h2>
                            <button onClick={closeModal} className="text-gray-500"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <input type="text" placeholder={t.idPlace} className="w-full industrial-input p-3 rounded" value={newMemory.title} onChange={e => setNewMemory({...newMemory, title: e.target.value})} />
                            <div className="flex gap-4">
                                <div className="flex-1 flex flex-col gap-1"><label className="text-[10px] text-gray-500 uppercase">{t.lat}</label><input type="number" step="any" className="w-full industrial-input p-2 text-sm rounded" value={newMemory.lat} onChange={e => setNewMemory({...newMemory, lat: e.target.value})} /></div>
                                <div className="flex-1 flex flex-col gap-1"><label className="text-[10px] text-gray-500 uppercase">{t.lng}</label><input type="number" step="any" className="w-full industrial-input p-2 text-sm rounded" value={newMemory.lng} onChange={e => setNewMemory({...newMemory, lng: e.target.value})} /></div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest">{t.dateTimeStr}</label>
                                <input type="datetime-local" className="w-full industrial-input p-2 text-sm text-gray-200 rounded" value={newMemory.datetime} onChange={e => setNewMemory({...newMemory, datetime: e.target.value})} />
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                {['text', 'photo', 'galerie', 'video', 'audio'].map(type => (
                                    <button key={type} onClick={(e) => { e.preventDefault(); setNewMemory({...newMemory, type}) }} className={`flex-1 min-w-[60px] py-1 text-[10px] uppercase border rounded ${newMemory.type === type ? 'bg-hlzPurple text-black border-hlzPurple font-bold' : 'border-gray-700 text-gray-500'}`}>{t.types[type]}</button>
                                ))}
                            </div>

                            <div className="flex justify-between items-center bg-[#050505] border border-gray-800 p-3 rounded">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-gray-500 uppercase">{t.directionView}:</span>
                                    <div className="relative w-12 h-12 flex items-center justify-center border-2 border-[#1e2029] bg-[#0a0a0c] rounded-full overflow-hidden shadow-[0_0_15px_rgba(166,33,255,0.1)]">
                                        <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', transform: `rotate(${newMemory.direction || 0}deg)`, transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}><path d="M24,24 L6,4 A26,26 0 0,1 42,4 Z" fill="rgba(166, 33, 255, 0.6)" stroke="#D8B4FE" strokeWidth="1.5" /></svg>
                                        <div className="absolute w-3 h-3 bg-white transform rotate-45 z-10 shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {[{v: 0, l: '↑'}, {v: 90, l: '→'}, {v: 180, l: '↓'}, {v: 270, l: '←'}].map(dir => (
                                        <button key={dir.v} onClick={(e) => { e.preventDefault(); setNewMemory({...newMemory, direction: dir.v}) }} className={`w-8 h-8 flex items-center justify-center border text-sm rounded transition-colors ${newMemory.direction === dir.v ? 'bg-hlzPurple text-black border-hlzPurple' : 'border-gray-700 text-gray-500 hover:border-hlzPurple hover:text-white'}`}>{dir.l}</button>
                                    ))}
                                </div>
                            </div>

                            <textarea placeholder={t.notes} className="w-full industrial-input p-3 h-20 resize-none rounded" value={newMemory.description} onChange={e => setNewMemory({...newMemory, description: e.target.value})}></textarea>
                            <input type="text" placeholder={newMemory.type === 'galerie' ? "URLs (séparées par une virgule)..." : t.mediaUrl} className="w-full industrial-input p-3 text-xs rounded" value={newMemory.content} onChange={e => setNewMemory({...newMemory, content: e.target.value})} />
                            
                            <div className="w-full industrial-input p-3 space-y-3 bg-[#050505] rounded">
                                <span className="text-[10px] text-gray-500 uppercase block">Tags</span>
                                <div className="max-h-[120px] overflow-y-auto pr-2 space-y-3">
                                    {Object.entries(currentHierarchy).map(([parent, data]) => (
                                        <div key={parent} className="border-l-2 pl-2" style={{ borderColor: data.color }}>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); const tgs = newMemory.tags ? newMemory.tags.split(',').map(t=>t.trim()).filter(Boolean) : []; setNewMemory({...newMemory, tags: (tgs.includes(parent) ? tgs.filter(t=>t!==parent) : [...tgs, parent]).join(', ')}); }}
                                                className={`text-[10px] px-2 py-0.5 border uppercase font-bold mb-1 rounded`}
                                                style={{ backgroundColor: newMemory.tags?.split(',').map(t=>t.trim()).includes(parent) ? data.color : 'transparent', borderColor: data.color, color: newMemory.tags?.split(',').map(t=>t.trim()).includes(parent) ? '#000' : data.color }}
                                            >#{parent}</button>
                                            <div className="flex flex-wrap gap-1 ml-2">
                                                {data.children.map(child => {
                                                    const isSel = newMemory.tags?.split(',').map(t=>t.trim()).includes(child);
                                                    return (
                                                    <button key={child} onClick={(e) => { e.preventDefault(); const tgs = newMemory.tags ? newMemory.tags.split(',').map(t=>t.trim()).filter(Boolean) : []; if (!tgs.includes(child) && !tgs.includes(parent)) tgs.push(parent); setNewMemory({...newMemory, tags: (tgs.includes(child) ? tgs.filter(t=>t!==child) : [...tgs, child]).join(', ')}); }} className={`text-[9px] px-1.5 py-0.5 border uppercase rounded-sm`} style={{ backgroundColor: isSel ? data.color : 'transparent', borderColor: isSel ? data.color : '#333', color: isSel ? '#000' : '#888' }}>
                                                        {child}
                                                    </button>
                                                )})}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <input type="text" placeholder="Tags manuais (vírgula)..." className="w-full bg-transparent border-t border-gray-800 pt-2 text-xs focus:outline-none rounded" value={newMemory.tags} onChange={e => setNewMemory({...newMemory, tags: e.target.value})} />
                            </div>

                            <button onClick={handleSaveMemory} className="w-full bg-hlzPurple text-black font-bold py-3 uppercase rounded">Salvar Ponto</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ABOUT (À PROPOS) */}
            {aboutTab && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8">
                    <div className="industrial-panel p-4 md:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto fade-in shadow-[0_0_50px_rgba(166,33,255,0.2)] border-hlzPurple rounded">
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
                                <div className="fade-in grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-white uppercase mb-4 border-l-2 border-hlzPurple pl-3">{t.aboutProjectTitle}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed text-justify font-light whitespace-pre-wrap">{t.aboutProjectDesc}</p>
                                    </div>
                                    <img src="https://pub-23caa2fc6265497690132d2d602d34b7.r2.dev/InfosMisia/camping.png" alt="Projet" className="w-full h-auto border border-gray-800 shadow-lg rounded" />
                                </div>
                            )}
                            {aboutTab === 'author' && (
                                <div className="fade-in grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-white uppercase mb-4 border-l-2 border-hlzPurple pl-3">{t.aboutAuthorTitle}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed text-justify font-light whitespace-pre-wrap">{t.aboutAuthorDesc}</p>
                                    </div>
                                    <img src="https://pub-23caa2fc6265497690132d2d602d34b7.r2.dev/InfosMisia/Misia_dessinMagali.png" alt="Autrice" className="w-full h-auto border border-gray-800 shadow-lg rounded" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {fullScreenItem && (
                <div className="fixed inset-0 z-[5000] bg-black/95 flex items-center justify-center p-4 fade-in" onClick={() => setFullScreenItem(null)}>
                    <button className="absolute top-6 right-6 text-gray-400 bg-black/50 p-2 rounded-full hover:text-white z-50"><X size={32} /></button>
                    
                    {fullScreenItem.type === 'photo' && <img src={fullScreenItem.src} className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />}
                    
                    {fullScreenItem.type === 'galerie' && (
                        <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            <img src={fullScreenItem.urls[fullScreenItem.currentIndex]} className="max-w-full max-h-full object-contain fade-in rounded" alt="zoom galerie"/>
                            
                            {fullScreenItem.urls.length > 1 && (
                                <>
                                    <button className="absolute left-4 md:left-12 top-1/2 transform -translate-y-1/2 bg-black/50 p-3 rounded-full text-white hover:bg-hlzPurple transition-colors z-50" onClick={(e) => { e.stopPropagation(); setFullScreenItem(prev => ({...prev, currentIndex: prev.currentIndex === 0 ? prev.urls.length - 1 : prev.currentIndex - 1})); }}>
                                        <ChevronRight size={32} className="rotate-180" />
                                    </button>
                                    <button className="absolute right-4 md:right-12 top-1/2 transform -translate-y-1/2 bg-black/50 p-3 rounded-full text-white hover:bg-hlzPurple transition-colors z-50" onClick={(e) => { e.stopPropagation(); setFullScreenItem(prev => ({...prev, currentIndex: prev.currentIndex === prev.urls.length - 1 ? 0 : prev.currentIndex + 1})); }}>
                                        <ChevronRight size={32} />
                                    </button>
                                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-4 py-2 rounded text-sm font-mono tracking-widest">
                                        {fullScreenItem.currentIndex + 1} / {fullScreenItem.urls.length}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    
                    {fullScreenItem.type === 'video' && <video src={fullScreenItem.src} controls autoPlay className="max-w-full max-h-full rounded" onClick={(e) => e.stopPropagation()}></video>}
                </div>
            )}
        </div>
    );
};

export default App;