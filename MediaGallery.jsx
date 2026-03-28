import React, { useState, useEffect } from 'react';
import './MediaGallery.css';

const MediaGallery = () => {
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    // Carrega automaticamente arquivos da pasta assets usando import.meta.glob (Vite)
    const loadMedia = async () => {
      // Usa caminho absoluto (/src/assets) para garantir localização correta
      // Adicionado ** para buscar recursivamente em subpastas
      // Adicionado suporte para extensões em maiúsculo (PNG, JPG, etc) e logs
      const modules = import.meta.glob('/src/assets/**/*.{png,jpg,jpeg,svg,mp4,webm,mp3,wav,PNG,JPG,JPEG,SVG,MP4,WEBM,MP3,WAV}', { eager: true });
      
      console.log("Arquivos de mídia encontrados:", Object.keys(modules)); // Verifique o console (F12)

      const items = Object.keys(modules).map((path) => {
        const src = modules[path].default;
        const extension = path.split('.').pop().toLowerCase();
        let type = 'unknown';
        
        if (['png', 'jpg', 'jpeg', 'svg'].includes(extension)) type = 'image';
        else if (['mp4', 'webm'].includes(extension)) type = 'video';
        else if (['mp3', 'wav'].includes(extension)) type = 'audio';

        return { path, src, type };
      });

      setMediaItems(items);
    };

    loadMedia();
  }, []);

  const openLightbox = (item) => {
    if (item.type === 'image' || item.type === 'video') {
      setSelectedMedia(item);
    }
  };

  const closeLightbox = () => {
    setSelectedMedia(null);
  };

  return (
    <div className="gallery-container">
      <div className="gallery-grid">
        {mediaItems.length === 0 && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>Nenhuma mídia encontrada. Verifique se seus arquivos estão na pasta <code>src/assets</code> local.</p>
        )}
        {mediaItems.map((item) => (
          <div key={item.path} className={`gallery-item ${item.type}`} onClick={() => openLightbox(item)}>
            {item.type === 'image' && <img src={item.src} alt="media asset" loading="lazy" />}
            {item.type === 'video' && <video src={item.src} muted playsInline />}
            {item.type === 'audio' && (
              <div className="audio-player" onClick={(e) => e.stopPropagation()}>
                <audio src={item.src} controls />
                <span>Audio</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedMedia && (
        <div className="lightbox" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeLightbox}>&times;</button>
            {selectedMedia.type === 'image' && <img src={selectedMedia.src} alt="fullscreen" />}
            {selectedMedia.type === 'video' && <video src={selectedMedia.src} controls autoPlay />}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;