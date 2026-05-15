'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tags predefinidos para noticiero de México
const PREDEFINED_TAGS = [
  'Política',
  'Economía',
  'Tecnología',
  'Deportes',
  'Cultura',
  'Salud',
  'Seguridad',
  'Educación',
  'Medio Ambiente',
  'Internacional',
  'Negocios',
  'Entretenimiento',
  'Sociedad',
  'Justicia',
  'Infraestructura',
];

interface MediaFile {
  id: string;
  file: File;
  type: 'image' | 'video';
  preview: string;
  order: number;
}

interface FormData {
  title: string;
  subtitle: string;
  body: string;
  categories: string[];
  tags: string[];
}

export default function NewsForm() {
  const [form, setForm] = useState<FormData>({
    title: '',
    subtitle: '',
    body: '',
    categories: [],
    tags: [],
  });

  const [media, setMedia] = useState<MediaFile[]>([]);
  const [inputTag, setInputTag] = useState('');
  const [inputCategory, setInputCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error'; text: string} | null>(null);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({...prev, [name]: value}));
  };

  const addTag = (tag?: string) => {
    const tagToAdd = tag || inputTag.trim();
    if (tagToAdd && !form.tags.includes(tagToAdd)) {
      setForm((prev) => ({...prev, tags: [...prev.tags, tagToAdd]}));
      setInputTag('');
      setShowTagDropdown(false);
    }
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({...prev, tags: prev.tags.filter((t) => t !== tag)}));
  };

  const addCategory = () => {
    if (inputCategory.trim() && !form.categories.includes(inputCategory.trim())) {
      setForm((prev) => ({...prev, categories: [...prev.categories, inputCategory.trim()]}));
      setInputCategory('');
    }
  };

  const removeCategory = (cat: string) => {
    setForm((prev) => ({...prev, categories: prev.categories.filter((c) => c !== cat)}));
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file, index) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (isImage || isVideo) {
        const preview = URL.createObjectURL(file);
        setMedia((prev) => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          file,
          type: isImage ? 'image' : 'video',
          preview,
          order: prev.length + index,
        }]);
      }
    });
    e.target.value = '';
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const moveMedia = (id: string, direction: 'up' | 'down') => {
    const index = media.findIndex((m) => m.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === media.length - 1)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newMedia = [...media];
    [newMedia[index], newMedia[newIndex]] = [newMedia[newIndex], newMedia[index]];
    setMedia(newMedia.map((m, i) => ({ ...m, order: i })));
  };

  const validateForm = (): boolean => {
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'El título es obligatorio' });
      return false;
    }
    if (!form.body.trim()) {
      setMessage({ type: 'error', text: 'El contenido es obligatorio' });
      return false;
    }
    return true;
  };

  const uploadMedia = async (articleId: string): Promise<void> => {
    for (const m of media) {
      const fileName = `${articleId}/${m.id}-${m.file.name}`;
      const bucketPath = `articles/${fileName}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('news-uploads')
          .upload(bucketPath, m.file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;

        const { error: mediaError } = await supabase.from('article_media').insert({
          article_id: articleId,
          file_path: bucketPath,
          file_type: m.type,
          display_order: m.order,
        });
        if (mediaError) throw mediaError;
      } catch (err) {
        console.error(`Error uploading media ${m.file.name}:`, err);
        throw err;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!validateForm()) return;
    setLoading(true);

    try {
      const { data: article, error: insertError } = await supabase
        .from('articles')
        .insert({
          title: form.title,
          subtitle: form.subtitle,
          body: form.body,
          categories: form.categories,
          tags: form.tags,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!article) throw new Error('No se pudo crear el artículo');

      if (media.length > 0) {
        try {
          await uploadMedia(article.id);
        } catch (mediaErr) {
          console.error('Media upload error:', mediaErr);
        }
      }

      setMessage({ type: 'success', text: `✓ Artículo creado. ID: ${article.id.slice(0, 8)}...` });
      setForm({ title: '', subtitle: '', body: '', categories: [], tags: [] });
      setMedia([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setMessage({ type: 'error', text: `Error: ${errorMsg}` });
    } finally {
      setLoading(false);
    }
  };

  const availableTags = PREDEFINED_TAGS.filter(tag => !form.tags.includes(tag));

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Publicar Noticia</h1>
        <p className="text-slate-600 mb-8">Completa el formulario para enviar tu artículo</p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Título *</label>
            <input type="text" name="title" value={form.title} onChange={handleInputChange} placeholder="Ej: Argentina avanza en energías renovables" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" required />
            <p className="mt-1 text-xs text-slate-500">{form.title.length} caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Subtítulo</label>
            <input type="text" name="subtitle" value={form.subtitle} onChange={handleInputChange} placeholder="Subtítulo más específico" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Contenido *</label>
            <textarea name="body" value={form.body} onChange={handleInputChange} placeholder="Escribe el contenido..." rows={8} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-vertical" required />
            <p className="mt-1 text-xs text-slate-500">{form.body.length} caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Categorías</label>
            <div className="flex gap-2 mb-3">
              <input type="text" value={inputCategory} onChange={(e) => setInputCategory(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} placeholder="Ej: Política" className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              <button type="button" onClick={addCategory} className="px-4 py-3 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300">+</button>
            </div>
            {form.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.categories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm">
                    {cat}
                    <button type="button" onClick={() => removeCategory(cat)} className="font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Tags</label>
            <div className="relative">
              <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  value={inputTag} 
                  onChange={(e) => { setInputTag(e.target.value); setShowTagDropdown(true); }} 
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} 
                  onFocus={() => setShowTagDropdown(true)}
                  placeholder="Busca o agrega un tag" 
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
                <button type="button" onClick={() => addTag()} className="px-4 py-3 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300">+</button>
              </div>

              {showTagDropdown && availableTags.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {availableTags
                    .filter(tag => tag.toLowerCase().includes(inputTag.toLowerCase()))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-100 border-b border-slate-200 last:border-b-0"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {form.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-900 rounded-full text-sm">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Imágenes y Videos</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400">
              <input type="file" id="media" multiple accept="image/*,video/*" onChange={handleMediaChange} className="hidden" />
              <label htmlFor="media" className="cursor-pointer block">
                <p className="text-slate-700 font-medium mb-1">📸 Selecciona imágenes o videos</p>
                <p className="text-sm text-slate-500">Arrastra o haz click</p>
              </label>
            </div>

            {media.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-slate-900">Medios ({media.length})</h3>
                {media.map((m, idx) => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-4 flex-1">
                      <img src={m.preview} alt={m.file.name} className="w-12 h-12 object-cover rounded" />
                      <div><p className="font-medium text-slate-900 text-sm">{m.file.name}</p></div>
                    </div>
                    <div className="flex gap-2">
                      {idx > 0 && <button type="button" onClick={() => moveMedia(m.id, 'up')} className="p-2 hover:bg-slate-200 rounded">↑</button>}
                      {idx < media.length - 1 && <button type="button" onClick={() => moveMedia(m.id, 'down')} className="p-2 hover:bg-slate-200 rounded">↓</button>}
                      <button type="button" onClick={() => removeMedia(m.id)} className="p-2 hover:bg-red-100 text-red-600 rounded">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 border-t border-slate-200 pt-6">
            <button type="submit" disabled={loading} className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? '⏳ Enviando...' : '✓ Publicar'}
            </button>
            <button type="reset" onClick={() => { setForm({ title: '', subtitle: '', body: '', categories: [], tags: [] }); setMedia([]); }} className="px-6 py-3 bg-slate-200 text-slate-900 font-semibold rounded-lg hover:bg-slate-300">
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
