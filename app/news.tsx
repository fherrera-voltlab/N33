'use client';

import React, { useState } from 'react';

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
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addTag = () => {
    if (inputTag.trim() && !form.tags.includes(inputTag.trim())) {
      setForm((prev) => ({
        ...prev,
        tags: [...prev.tags, inputTag.trim()],
      }));
      setInputTag('');
    }
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const addCategory = () => {
    if (
      inputCategory.trim() &&
      !form.categories.includes(inputCategory.trim())
    ) {
      setForm((prev) => ({
        ...prev,
        categories: [...prev.categories, inputCategory.trim()],
      }));
      setInputCategory('');
    }
  };

  const removeCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== cat),
    }));
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file, index) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (isImage || isVideo) {
        const preview = URL.createObjectURL(file);
        setMedia((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            file,
            type: isImage ? 'image' : 'video',
            preview,
            order: prev.length + index,
          },
        ]);
      }
    });

    e.target.value = '';
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const moveMedia = (id: string, direction: 'up' | 'down') => {
    const index = media.findIndex((m) => m.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === media.length - 1)) {
      return;
    }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Convertir archivos a base64 para enviar por webhook
      const mediaData = await Promise.all(
        media.map(async (m) => {
          const buffer = await m.file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          return {
            name: m.file.name,
            type: m.type,
            size: m.file.size,
            base64: base64,
            order: m.order,
          };
        })
      );

      // Enviar al webhook de n8n
      const response = await fetch('https://n8n.voltlab.voltlap.com/webhook/N33', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title,
          subtitle: form.subtitle,
          body: form.body,
          categories: form.categories.length > 0 ? form.categories : [],
          tags: form.tags.length > 0 ? form.tags : [],
          media: mediaData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Error al enviar: ${response.statusText}`);
      }

      const result = await response.json();

      setMessage({
        type: 'success',
        text: `✓ Artículo enviado correctamente. ID: ${result.id || 'procesando...'}`,
      });

      setForm({
        title: '',
        subtitle: '',
        body: '',
        categories: [],
        tags: [],
      });
      setMedia([]);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      setMessage({ type: 'error', text: `Error: ${errorMsg}` });
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Publicar Noticia
          </h1>
          <p className="text-slate-600">
            Completa el formulario para enviar tu artículo
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white rounded-lg shadow-sm border border-slate-200 p-8"
        >
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-semibold text-slate-900 mb-2"
            >
              Título *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={form.title}
              onChange={handleInputChange}
              placeholder="Ej: Argentina avanza en energías renovables"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              {form.title.length} caracteres
            </p>
          </div>

          <div>
            <label
              htmlFor="subtitle"
              className="block text-sm font-semibold text-slate-900 mb-2"
            >
              Subtítulo (Opcional)
            </label>
            <input
              type="text"
              id="subtitle"
              name="subtitle"
              value={form.subtitle}
              onChange={handleInputChange}
              placeholder="Subtítulo más específico"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label
              htmlFor="body"
              className="block text-sm font-semibold text-slate-900 mb-2"
            >
              Contenido *
            </label>
            <textarea
              id="body"
              name="body"
              value={form.body}
              onChange={handleInputChange}
              placeholder="Escribe el contenido de la noticia..."
              rows={8}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-vertical"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              {form.body.length} caracteres
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Categorías (Opcional)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={inputCategory}
                onChange={(e) => setInputCategory(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="Ej: Política, Economía"
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
              <button
                type="button"
                onClick={addCategory}
                className="px-4 py-3 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300 transition"
              >
                +
              </button>
            </div>
            {form.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm"
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="font-bold hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Tags (Opcional)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Ej: energía, sostenibilidad"
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-3 bg-slate-200 text-slate-900 font-medium rounded-lg hover:bg-slate-300 transition"
              >
                +
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-900 rounded-full text-sm"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="font-bold hover:text-purple-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Imágenes y Videos (Opcional)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 transition">
              <input
                type="file"
                id="media"
                multiple
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="hidden"
              />
              <label htmlFor="media" className="cursor-pointer block">
                <p className="text-slate-700 font-medium mb-1">📸 Selecciona imágenes o videos</p>
                <p className="text-sm text-slate-500">Arrastra aquí o haz click para seleccionar</p>
              </label>
            </div>

            {media.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-slate-900">Medios ({media.length})</h3>
                {media.map((m, idx) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={m.preview}
                        alt={m.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-slate-900 text-sm">{m.file.name}</p>
                        <p className="text-xs text-slate-500">
                          {(m.file.size / 1024 / 1024).toFixed(2)} MB • {m.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveMedia(m.id, 'up')}
                          className="p-2 hover:bg-slate-200 rounded transition"
                          title="Mover arriba"
                        >
                          ↑
                        </button>
                      )}
                      {idx < media.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveMedia(m.id, 'down')}
                          className="p-2 hover:bg-slate-200 rounded transition"
                          title="Mover abajo"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.id)}
                        className="p-2 hover:bg-red-100 text-red-600 rounded transition"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 border-t border-slate-200 pt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? '⏳ Enviando...' : '✓ Publicar'}
            </button>
            <button
              type="reset"
              onClick={() => {
                setForm({
                  title: '',
                  subtitle: '',
                  body: '',
                  categories: [],
                  tags: [],
                });
                setMedia([]);
              }}
              className="px-6 py-3 bg-slate-200 text-slate-900 font-semibold rounded-lg hover:bg-slate-300 transition"
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
